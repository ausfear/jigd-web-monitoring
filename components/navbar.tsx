"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ExternalLink, 
  LayoutDashboard, 
  Home, 
  MapPin, 
  LogOut, 
  LogIn, 
  UserCheck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  currentPage?: "home" | "dashboard" | "overview" | "produsen" | "datasets" | "login";
}

export function Navbar({ currentPage = "home" }: NavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

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

  const navItems = [
    { label: "Beranda", href: "/", id: "home" },
    { label: "Overview", href: "/overview", id: "overview" },
    { label: "Produsen", href: "/produsen", id: "produsen" },
    { label: "Datasets", href: "/datasets", id: "datasets" },
    { label: "Verifikasi", href: "/dashboard", id: "dashboard" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/90 backdrop-blur-md transition-colors shadow-2xs">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Top-left: Administrative Branding */}
        <Link href="/" className="flex items-center gap-3 group transition-opacity hover:opacity-95">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 ring-1 ring-emerald-500/40">
            <MapPin className="h-5 w-5 text-white group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Web Monitoring JIGD
            </span>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 leading-tight">
              Provinsi Kalimantan Timur
            </span>
          </div>
        </Link>

        {/* Center: Main Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
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

        {/* Top-right: Links, External Geoportal Link, Auth Controls & Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="md:hidden flex items-center">
            {currentPage !== "dashboard" ? (
              <Link href="/dashboard">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-slate-200 hover:bg-slate-100 text-slate-800 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 font-medium text-xs h-8 px-2.5"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-slate-200 hover:bg-slate-100 text-slate-800 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 font-medium text-xs h-8 px-2.5"
                >
                  <Home className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400" />
                  Beranda
                </Button>
              </Link>
            )}
          </div>

          <a
            href="https://jigd.kaltimprov.go.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex"
          >
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs text-xs h-8 px-3"
            >
              <span>Geoportal Kaltim</span>
              <ExternalLink className="h-3.5 w-3.5 ml-1.5 opacity-80" />
            </Button>
          </a>

          {/* Authentication Action Button (Login / Logout) */}
          {!isLoadingAuth && (
            <>
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                    <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="max-w-[120px] truncate">{user.email?.split("@")[0] || "Admin"}</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 font-medium text-xs h-8 px-2.5 shadow-2xs cursor-pointer transition-colors"
                    title="Keluar dari akun administrator"
                  >
                    <LogOut className="h-3.5 w-3.5 sm:mr-1 text-rose-500" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              ) : (
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs h-8 px-2.5 shadow-2xs cursor-pointer"
                  >
                    <LogIn className="h-3.5 w-3.5 sm:mr-1 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">Login</span>
                  </Button>
                </Link>
              )}
            </>
          )}

          {/* Dark Mode Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
