"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12 relative overflow-hidden">
        {/* Subtle topographic background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-gradient-to-tr from-blue-100/40 via-indigo-50/20 to-transparent dark:from-blue-950/25 dark:via-slate-900/20 dark:to-transparent -z-10 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md">
          {/* Top Emblem */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-4 ring-blue-500/10 mb-3">
              <MapPin className="h-7 w-7 text-white" />
            </div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              JIGD Provinsi Kalimantan Timur
            </div>
          </div>

          <Card className="border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur-sm">
            <CardHeader className="space-y-1.5 text-center pb-5">
              <CardTitle className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                Login JIGD Kaltim
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Masuk dengan akun administrator terdaftar untuk mengakses dan memverifikasi data geospasial daerah.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {errorMessage && (
                <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div className="flex-1">{errorMessage}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-email"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Alamat Email <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="admin@kaltimprov.go.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    className="h-10 text-xs sm:text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Kata Sandi <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="h-10 text-xs sm:text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                      title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memverifikasi...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Masuk ke Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>

            {/* Bottom info notice */}
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 rounded-b-xl">
              <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Portal publik (<Link href="/overview" className="text-blue-600 dark:text-blue-400 hover:underline">Overview</Link>, <Link href="/produsen" className="text-blue-600 dark:text-blue-400 hover:underline">Produsen</Link>, <Link href="/datasets" className="text-blue-600 dark:text-blue-400 hover:underline">Datasets</Link>) dapat diakses bebas tanpa login.
                </span>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
