import Link from "next/link";
import { ExternalLink, LayoutDashboard, Home, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavbarProps {
  currentPage?: "home" | "dashboard" | "overview" | "produsen" | "datasets";
}

export function Navbar({ currentPage = "home" }: NavbarProps) {
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

        {/* Top-right: Links, External Geoportal Link & Theme Toggle */}
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

          {/* Dark Mode Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
