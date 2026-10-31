"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  currentPage?: "home" | "dashboard" | "overview" | "produsen" | "datasets" | "login";
}

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

export function Navbar({ currentPage = "home" }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // 1. Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoadingAuth(false);
    });

    // 2. Real-time subscription to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoadingAuth(true);
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-sheet/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[60px] w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-10">
        {/* Top-left: Administrative Branding */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 text-ink">
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
        <nav className="hidden lg:flex items-center gap-[22px] self-stretch text-sm">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full items-center border-b-2 pt-0.5 transition-colors ${
                  isActive
                    ? "border-qty font-semibold text-ink"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Top-right: External Geoportal Link, Auth Controls, Theme Toggle & Mobile Menu */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
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
                <div className="flex items-center gap-2">
                  <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-ink-2">
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[120px] truncate">{user.email?.split("@")[0] || "Admin"}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
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
                    "h-9 sm:h-8 px-3 border-ink bg-transparent text-ink text-sm hover:bg-ink/5 dark:bg-transparent dark:hover:bg-ink/10"
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
              const isActive = currentPage === item.id;
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
