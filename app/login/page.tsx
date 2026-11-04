"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { supabase, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Silakan isi alamat email dan password Anda.");
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Humanize common Supabase auth error messages to Indonesian
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Email atau kata sandi tidak cocok. Silakan periksa kembali.");
        } else if (error.message.includes("Email not confirmed")) {
          setErrorMessage("Alamat email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.");
        } else if (error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500) {
          setErrorMessage(DB_UNREACHABLE_MESSAGE);
        } else {
          setErrorMessage(error.message || "Gagal masuk. Silakan coba lagi.");
        }
        return;
      }

      if (data?.user) {
        // Refresh page state and navigate to protected verification dashboard
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mencoba masuk."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">

      <main className="flex-1 flex items-start justify-center px-4 sm:px-6 pt-14 pb-16 sm:pt-20">
        <div className="w-full max-w-[26rem]">
          <h1 className="font-cond text-[32px] font-[750] leading-[1.05]">Masuk untuk verifikasi</h1>
          <p className="mt-2 text-ink-2">
            Khusus petugas verifikasi daftar data. Overview, Produsen, dan Katalog layer bisa dibuka tanpa masuk.
          </p>

          <div className="mt-8 border-2 border-ink bg-sheet p-6">
            {errorMessage && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 border border-bound border-l-4 p-3 text-sm text-bound animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-semibold">
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="nama@kaltimprov.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-10 text-[15px] bg-sheet border-ink/40 focus-visible:ring-qty/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold">
                  Kata sandi
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan kata sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="h-10 text-[15px] bg-sheet border-ink/40 focus-visible:ring-qty/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-2 hover:text-ink"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-qty hover:bg-qty/90 text-sheet text-[15px] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memeriksa…
                  </span>
                ) : (
                  "Masuk"
                )}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-sm text-ink-2">
            Kembali ke <Link href="/overview" className="text-link hover:underline">Overview</Link> atau{" "}
            <Link href="/" className="text-link hover:underline">Beranda</Link>.
          </p>
        </div>
      </main>

    </div>
  );
}
