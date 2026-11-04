"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ExternalLink,
  LogOut,
  LogIn,
  UserCheck,
  Menu,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase";
import { useAuthUser } from "@/lib/use-auth-user";
import { cn } from "@/lib/utils";

const GEOPORTAL_URL = "https://jigd.kaltimprov.go.id/";

const navItems = [
  { label: "Beranda", href: "/", id: "home" },
  { label: "Overview", href: "/overview", id: "overview" },
  { label: "Produsen", href: "/produsen", id: "produsen" },
  { label: "Datasets", href: "/datasets", id: "datasets" },
  { label: "Verifikasi", href: "/dashboard", id: "dashboard" },
];

/** Logo: bingkai lembar peta dengan garis grid, selaras dengan bingkai halaman Overview. */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <rect x="1.5" y="1.5" width="25" height="25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="5" width="18" height="18" stroke="currentColor" strokeWidth="2.5" />
      <path d="M14 5v18M5 14h18" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

/** Menu aktif dari alamat halaman (navbar dipasang sekali di layout, jadi tidak menerima prop). */
function activeIdFor(pathname: string): string | null {
  if (pathname === "/") return "home";
  const item = navItems.find((i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(i.href + "/")));
  return item?.id ?? null;
}

/**
 * Garis penanda menu aktif yang bergeser halus ke menu baru. Posisinya ditulis langsung ke
 * elemen (tanpa state) setelah diukur; pemasangan pertama dan perubahan ukuran tanpa transisi.
 */
function useActiveIndicator(activeId: string | null) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const placedRef = useRef(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const bar = indicatorRef.current;
    if (!nav || !bar) return;

    const place = (animate: boolean) => {
      const link = activeId ? nav.querySelector<HTMLElement>(`[data-nav-id="${activeId}"]`) : null;
      if (!link) {
        bar.style.opacity = "0";
        return;
      }
      const instant = !animate || !placedRef.current;
      if (instant) bar.style.transition = "none";
      bar.style.transform = `translateX(${link.offsetLeft}px)`;
      bar.style.width = `${link.offsetWidth}px`;
      bar.style.opacity = "1";
      placedRef.current = true;
      if (instant) {
        void bar.offsetWidth; // terapkan posisi tanpa animasi, baru nyalakan transisi lagi
        bar.style.transition = "";
      }
    };

    place(true);
    // Lebar menu berubah saat font selesai dimuat atau jendela diubah ukurannya
    // (panggilan pertama ResizeObserver terjadi langsung saat mulai memantau; abaikan agar animasi tidak terpotong)
    let awal = true;
    const observer = new ResizeObserver(() => {
      if (awal) {
        awal = false;
        return;
      }
      place(false);
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeId]);

  return { navRef, indicatorRef };
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeId = activeIdFor(pathname);
  const { user, loading: isLoadingAuth } = useAuthUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { navRef, indicatorRef } = useActiveIndicator(activeId);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-sheet/95 backdrop-blur-sm">
      {/* Tiga kolom (kiri | menu | kanan): menu tetap di tengah walau isi kanan berubah lebar */}
      <div className="mx-auto flex h-[60px] w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-10 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* Top-left: Administrative Branding */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 justify-self-start text-ink">
          <BrandMark className="h-7 w-7 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-cond text-[17px] font-bold leading-tight">
              Web Monitoring JIGD
            </span>
            <span className="truncate text-xs leading-tight text-ink-2">
              Provinsi Kalimantan Timur
            </span>
          </div>
        </Link>

        {/* Center: Main Navigation Links (Desktop) */}
        <nav ref={navRef} className="relative hidden lg:flex items-center gap-[22px] self-stretch text-sm">
          {navItems.map((item) => {
            const isActive = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                data-nav-id={item.id}
                data-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center pt-0.5 transition-colors",
                  // Ruang untuk versi tebal teks, agar menu tidak bergeser saat menjadi aktif
                  "after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]",
                  isActive ? "font-semibold text-ink" : "text-ink-2 hover:text-ink"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <span
            ref={indicatorRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-qty opacity-0 transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          />
        </nav>

        {/* Top-right: External Geoportal Link, Auth Controls, Theme Toggle & Mobile Menu */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5 justify-self-end">
          <a
            href={GEOPORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-1 text-sm text-link hover:underline"
          >
            Geoportal Kaltim
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>

          {/* Authentication Action Button (Login / Logout) */}
          {!isLoadingAuth && (
            <>
              {user ? (
                <div className="flex items-center gap-2 animate-reveal">
                  <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-ink-2">
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[120px] truncate">{user.email?.split("@")[0] || "Admin"}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className={"h-9 sm:h-8 px-3 border-ink bg-transparent text-ink text-sm hover:bg-ink/5 dark:bg-transparent dark:hover:bg-ink/10"}
                    title="Keluar dari akun administrator"
                    aria-label="Keluar"
                  >
                    <LogOut className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
                    <span className="hidden sm:inline">Keluar</span>
                  </Button>
                </div>
              ) : (
                <Link
                  href="/login"
                  aria-label="Masuk"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "animate-reveal h-9 sm:h-8 px-3 border-ink bg-transparent text-ink text-sm hover:bg-ink/5 dark:bg-transparent dark:hover:bg-ink/10"
                  )}
                >
                  <LogIn className="h-3.5 w-3.5 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">Masuk</span>
                </Link>
              )}
            </>
          )}

          {/* Dark Mode Toggle */}
          <ThemeToggle />

          {/* Mobile / Tablet Menu Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            className="lg:hidden h-9 w-9 border-ink/30 bg-transparent text-ink hover:bg-ink/5 dark:bg-transparent dark:hover:bg-ink/10"
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile / Tablet Navigation Panel */}
      {isMenuOpen && (
        <nav
          id="mobile-nav"
          className="lg:hidden border-t border-rule bg-sheet animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="mx-auto grid w-full max-w-[1240px] px-4 py-2 sm:px-10">
            {navItems.map((item) => {
              const isActive = activeId === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`border-l-2 px-3 py-2.5 text-[15px] transition-colors ${
                    isActive
                      ? "border-qty font-semibold text-ink"
                      : "border-transparent text-ink-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <a
              href={GEOPORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1.5 border-t border-rule px-3 py-3 text-[15px] text-link"
            >
              Geoportal Kaltim
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            {user && (
              <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-ink-2">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Masuk sebagai {user.email}
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
