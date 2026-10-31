"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DbErrorBanner } from "@/components/db-error-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Search,
  Calendar,
  Layers,
  FileCheck2,
  MoreHorizontal,
  Database,
  Loader2,
  TrendingUp,
  Award,
} from "lucide-react";
import { supabase, fetchAllRows, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";
import { fetchTahunAktif, TAHUN_DEFAULT } from "@/lib/tahun";
import { MasterOpd, DaftarData, CacheLayerGeoportal } from "@/types/database";

/** Ambil data produsen dari Supabase secara paralel (tidak menyentuh state React). */
function loadProdusenData() {
  return Promise.all([
    supabase.from("master_opd").select("*").order("nama_opd", { ascending: true }),
    fetchAllRows<DaftarData>((from, to) =>
      supabase.from("daftar_data").select("*").order("id").range(from, to)
    ),
    fetchAllRows<CacheLayerGeoportal>((from, to) =>
      supabase.from("cache_layer_geoportal").select("*").order("id_dataset").range(from, to)
    ),
    fetchTahunAktif(),
  ]);
}

export default function ProdusenPage() {
  const router = useRouter();
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [dataList, setDataList] = useState<DaftarData[]>([]);
  const [cachedLayers, setCachedLayers] = useState<CacheLayerGeoportal[]>([]);
  const [tahunAktif, setTahunAktif] = useState<number[]>(TAHUN_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters (null = tahun aktif terbaru)
  const [searchQuery, setSearchQuery] = useState("");
  const [yearChoice, setYearChoice] = useState<string | null>(null);
  const selectedYear = yearChoice ?? String(Math.max(...tahunAktif));
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(true);

  // Fetch data
  const fetchData = useCallback(
    () =>
      loadProdusenData()
        .then(([opdRes, daftarRes, layersRes, tahun]) => {
          if (opdRes.data) setOpdList(opdRes.data);
          if (!daftarRes.error) setDataList(daftarRes.data);
          if (!layersRes.error) setCachedLayers(layersRes.data);
          setTahunAktif(tahun);
          setLoadError(opdRes.error || daftarRes.error || layersRes.error ? DB_UNREACHABLE_MESSAGE : null);
        })
        .catch((err) => {
          console.error("Error fetching produsen data:", err);
          setLoadError(DB_UNREACHABLE_MESSAGE);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pilihan tahun mengikuti Pengaturan Tahun (terbaru di atas)
  const availableYears = useMemo(() => [...tahunAktif].sort((a, b) => b - a), [tahunAktif]);

  // Map layer counts by owner_username
  const layerCountsByOwner = useMemo(() => {
    const map = new Map<string, number>();
    cachedLayers.forEach((l) => {
      if (l.owner_username) {
        const u = l.owner_username.toLowerCase();
        map.set(u, (map.get(u) || 0) + 1);
      }
    });
    return map;
  }, [cachedLayers]);

  // Compute statistics per OPD based on selected year
  const opdStats = useMemo(() => {
    return opdList.map((opd) => {
      // Find rows for this OPD
      const opdRows = dataList.filter((d) => {
        if (d.opd_id !== opd.id) return false;
        if (selectedYear === "all") return true;
        return Array.isArray(d.tahun_berlaku) && d.tahun_berlaku.includes(parseInt(selectedYear, 10));
      });

      const totalTarget = opdRows.length;
      const filledCount = opdRows.filter((d) => d.status_keterisian).length;
      const percent = totalTarget > 0 ? Math.round((filledCount / totalTarget) * 100) : 0;
      const kugiCount = opdRows.filter((d) => Boolean(d.kugi_id || d.kugi_nama_unsur)).length;

      const layerCount = opd.username_jigd
        ? layerCountsByOwner.get(opd.username_jigd.toLowerCase()) || 0
        : 0;

      return {
        ...opd,
        totalTarget,
        filledCount,
        percent,
        kugiCount,
        layerCount,
      };
    });
  }, [opdList, dataList, selectedYear, layerCountsByOwner]);

  // Filter OPDs by search and showActiveOnly
  const filteredOpds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return opdStats.filter((opd) => {
      if (showActiveOnly && opd.totalTarget === 0) {
        return false;
      }

      if (!q) return true;
      return (
        opd.nama_opd?.toLowerCase().includes(q) ||
        opd.username_jigd?.toLowerCase().includes(q)
      );
    });
  }, [opdStats, searchQuery, showActiveOnly]);

  // High-level aggregate KPIs: Count OPDs that have at least 1 daftar_data for selected year
  const activeOpdCount = useMemo(() => {
    return opdStats.filter((o) => o.totalTarget > 0).length;
  }, [opdStats]);

  const totalTargetAll = useMemo(() => {
    return opdStats.reduce((acc, curr) => acc + curr.totalTarget, 0);
  }, [opdStats]);

  const totalFilledAll = useMemo(() => {
    return opdStats.reduce((acc, curr) => acc + curr.filledCount, 0);
  }, [opdStats]);

  const avgPercent = useMemo(() => {
    if (totalTargetAll === 0) return 0;
    return Math.round((totalFilledAll / totalTargetAll) * 100);
  }, [totalTargetAll, totalFilledAll]);

  const completeOpdCount = useMemo(() => {
    return opdStats.filter((o) => o.totalTarget > 0 && o.filledCount === o.totalTarget).length;
  }, [opdStats]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar currentPage="produsen" />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <DbErrorBanner message={loadError} />
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              JIGD Kaltim
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              OPD Produsen Data Geospasial
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Rekapitulasi kesiapan data, pemetaan standar KUGI, dan verifikasi publikasi layer per Perangkat Daerah.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
              >
                <FileCheck2 className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
                Verifikasi Data
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1 */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Produsen Data
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {activeOpdCount} OPD
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                OPD memiliki target data tahun {selectedYear === "all" ? "berlaku" : selectedYear}
              </p>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Target Data ({selectedYear === "all" ? "Semua Tahun" : selectedYear})
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {totalTargetAll}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Total item daftar data geospasial
              </p>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Rata-rata Keterisian
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {avgPercent}%
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {totalFilledAll} dari {totalTargetAll} data terverifikasi
              </p>
            </CardContent>
          </Card>

          {/* Card 4 */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                OPD 100% Terpenuhi
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Award className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {completeOpdCount} OPD
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                Keterisian layer lengkap terhubung
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Produsen Table Section */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Daftar Perangkat Daerah &amp; Status Keterisian
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring kemajuan integrasi data spasial per instansi produsen
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari nama OPD atau akun..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
                />
              </div>

              {/* Year Filter */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  id="filter-year-produsen"
                  value={selectedYear}
                  onChange={(e) => setYearChoice(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="all">Semua Tahun</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle: Hanya tampilkan OPD ber-daftar data */}
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setShowActiveOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <span className="whitespace-nowrap">Hanya tampilkan OPD ber-daftar data</span>
              </label>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Memuat data produsen...</p>
            </div>
          ) : filteredOpds.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
              <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Tidak ada OPD yang cocok
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Coba sesuaikan kata kunci pencarian.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="text-xs"
                >
                  Reset Pencarian
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <TableHead className="w-[50px] text-center font-bold">#</TableHead>
                    <TableHead className="min-w-[280px] font-bold">Perangkat Daerah (OPD)</TableHead>
                    <TableHead className="min-w-[130px] font-bold text-center">Total Daftar Data</TableHead>
                    <TableHead className="min-w-[130px] font-bold text-center">Layer Terpublikasi</TableHead>
                    <TableHead className="min-w-[220px] font-bold">Persentase Keterisian</TableHead>
                    <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpds.map((opd, idx) => {
                    const opdParam = opd.username_jigd || opd.id;

                    return (
                      <TableRow
                        key={opd.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 transition-colors"
                      >
                        {/* Index */}
                        <TableCell className="text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                          {idx + 1}
                        </TableCell>

                        {/* OPD Name & Username */}
                        <TableCell className="py-3">
                          <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                            {opd.nama_opd}
                          </div>
                          {opd.username_jigd && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] mt-1 font-mono font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            >
                              @{opd.username_jigd}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Total Daftar Data */}
                        <TableCell className="text-center">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {opd.totalTarget}
                          </span>
                          <span className="text-[11px] text-slate-400 block">data</span>
                        </TableCell>

                        {/* Total Layer Geoportal */}
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                          >
                            <Database className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
                            {opd.layerCount} Layer
                          </Badge>
                        </TableCell>

                        {/* Progress Keterisian */}
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                                {opd.filledCount} dari {opd.totalTarget} terisi
                              </span>
                              <span
                                className={`font-bold text-[11px] ${
                                  opd.percent === 100
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : opd.percent > 0
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {opd.percent}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  opd.percent === 100
                                    ? "bg-emerald-500"
                                    : opd.percent > 0
                                    ? "bg-blue-600"
                                    : "bg-slate-300 dark:bg-slate-700"
                                }`}
                                style={{ width: `${opd.percent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Action Menu */}
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => router.push(`/datasets?opd=${encodeURIComponent(opdParam)}`)}
                                className="flex items-center gap-2 cursor-pointer text-xs"
                              >
                                <Database className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Lihat Layer di Katalog</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/dashboard?opd=${encodeURIComponent(opdParam)}`)}
                                className="flex items-center gap-2 cursor-pointer text-xs"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Buka Verifikasi Data</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Menampilkan <strong>{filteredOpds.length}</strong> Perangkat Daerah
              {showActiveOnly && (
                <span className="ml-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  (Hanya OPD ber-daftar data)
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
              Filter Tahun: {selectedYear === "all" ? "Semua Tahun" : selectedYear}
            </span>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
