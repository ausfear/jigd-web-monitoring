"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  MapPin,
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
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/90 backdrop-blur-md transition-colors shadow-2xs">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Top-left: Administrative Branding */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 group transition-opacity hover:opacity-95">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 ring-1 ring-emerald-500/40">
            <MapPin className="h-5 w-5 text-white group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Web Monitoring JIGD
            </span>
            <span className="truncate text-[11px] font-semibold text-blue-600 dark:text-blue-400 leading-tight">
              Provinsi Kalimantan Timur
            </span>
          </div>
        </Link>

        {/* Center: Main Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50"
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
            className={cn(
              buttonVariants({ size: "sm" }),
              "hidden lg:inline-flex bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs text-xs h-8 px-3"
            )}
          >
            <span>Geoportal Kaltim</span>
            <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-80" />
          </a>

          {/* Authentication Action Button (Login / Logout) */}
          {!isLoadingAuth && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                    <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="max-w-[120px] truncate">{user.email?.split("@")[0] || "Admin"}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 font-medium text-xs h-9 sm:h-8 px-2.5 shadow-2xs cursor-pointer transition-colors"
                    title="Keluar dari akun administrator"
                    aria-label="Logout"
                  >
                    <LogOut className="h-3.5 w-3.5 sm:mr-1 text-rose-500" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              ) : (
                <Link
                  href="/login"
                  aria-label="Login"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs h-9 sm:h-8 px-2.5 shadow-2xs"
                  )}
                >
                  <LogIn className="h-3.5 w-3.5 sm:mr-1 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Login</span>
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
            className="lg:hidden h-9 w-9 rounded-lg border-slate-200 bg-white hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 shadow-2xs"
          >
            {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile / Tablet Navigation Panel */}
      {isMenuOpen && (
        <nav
          id="mobile-nav"
          className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="container mx-auto px-4 sm:px-6 py-3 grid gap-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
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
              className="mt-1 flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80"
            >
              Geoportal Kaltim
              <ExternalLink className="h-4 w-4 opacity-80" />
            </a>
            {user && (
              <div className="px-3 pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Masuk sebagai {user.email}
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
