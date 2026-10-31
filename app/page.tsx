import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import {
  Building2,
  ArrowRight,
  Layers,
  ExternalLink,
  ShieldCheck,
  Compass,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar currentPage="home" />

      <main className="flex-1">
        {/* Hero Section with subtle administrative topographic background */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-200/80 dark:border-slate-800/80">
          {/* Subtle topographic contour gradient aura */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-100/50 via-slate-100/30 to-transparent dark:from-blue-950/30 dark:via-slate-900/20 dark:to-transparent -z-10 blur-3xl pointer-events-none" />
          
          {/* Subtle topographic contour lines SVG pattern */}
          <div className="absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="container mx-auto px-4 sm:px-6 max-w-5xl text-center">
            {/* Main Official Heading */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.2] mb-6">
              Web Monitoring JIGD Provinsi Kalimantan Timur
            </h1>

            {/* Official Description */}
            <p className="mx-auto max-w-3xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-10">
              Web-Based Monitoring App untuk monitoring kelengkapan data geospasial, pencocokan Katalog Unsur Geografi Indonesia (KUGI), dan status publikasi layer pada Portal Jaringan Informasi Geospasial Daerah Kalimantan Timur
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>Buka Dashboard Monitoring</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>

              <a
                href="https://jigd.kaltimprov.go.id/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-7 rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium shadow-xs"
                >
                  <Layers className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                  <span>Kunjungi Geoportal Kaltim</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-2 opacity-70" />
                </Button>
              </a>
            </div>

            {/* Navigation Cards Grid (Overview, Produsen, Datasets) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-16 sm:mt-20">
              {/* Card 1: Dashboard Overview */}
              <Link href="/overview" className="group block focus:outline-none">
                <Card className="h-full border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold group-hover:scale-105 transition-transform">
                        <Compass className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Dashboard Overview
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      Ringkasan statistik, sebaran jenis data, dan penggunaan sistem koordinat.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Card 2: OPD Produsen Data */}
              <Link href="/produsen" className="group block focus:outline-none">
                <Card className="h-full border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold group-hover:scale-105 transition-transform">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      OPD Produsen Data
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      Rekapitulasi daftar data geospasial dan status keterisian per Perangkat Daerah.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Card 3: Katalog Dataset JIGD */}
              <Link href="/datasets" className="group block focus:outline-none">
                <Card className="h-full border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold group-hover:scale-105 transition-transform">
                        <Layers className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Katalog Dataset JIGD
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      Eksplorasi seluruh layer geospasial yang telah diunggah ke simpul jaringan.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        {/* Official Governance & Legal Reference Section */}
        <section className="py-12 bg-white/70 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-blue-950/20 p-6 sm:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Landasan Tata Kelola Data Geospasial</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Penyelenggaraan Simpul Jaringan Daerah Terintegrasi
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Mendukung pelaksanaan Peraturan Presiden No. 39 Tahun 2019 tentang Satu Data Indonesia dan Peraturan Presiden No. 27 Tahun 2014 tentang Jaringan Informasi Geospasial Nasional untuk mewujudkan keterpaduan perencanaan pembangunan daerah.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link href="/dashboard">
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                    >
                      Buka Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
