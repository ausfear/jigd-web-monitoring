"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DbErrorBanner } from "@/components/db-error-banner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  Globe2,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  FileCheck2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { supabase, fetchAllRows, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";
import { fetchTahunAktif, formatDaftarTahun, TAHUN_DEFAULT } from "@/lib/tahun";
import { useMounted } from "@/lib/use-mounted";
import { CacheLayerGeoportal, MasterOpd, DaftarData } from "@/types/database";

const GEOMETRY_COLORS = [
  "#2563eb", // blue-600
  "#0284c7", // sky-600
  "#4f46e5", // indigo-600
  "#0d9488", // teal-600
  "#059669", // emerald-600
  "#64748b", // slate-500
  "#d97706", // amber-600
];

const SRID_COLORS = [
  "#2563eb", // blue-600
  "#059669", // emerald-600
  "#7c3aed", // violet-600
  "#ea580c", // orange-600
  "#64748b", // slate-500
];

/** Ambil data statistik dari Supabase secara paralel (tidak menyentuh state React). */
function loadOverviewData() {
  return Promise.all([
    fetchAllRows<CacheLayerGeoportal>((from, to) =>
      supabase.from("cache_layer_geoportal").select("*").order("id_dataset").range(from, to)
    ),
    supabase.from("master_opd").select("*"),
    fetchAllRows<DaftarData>((from, to) =>
      supabase.from("daftar_data").select("*").order("id").range(from, to)
    ),
    fetchTahunAktif(),
  ]);
}

export default function OverviewPage() {
  const isMounted = useMounted();
  const [layers, setLayers] = useState<CacheLayerGeoportal[]>([]);
  const [opds, setOpds] = useState<MasterOpd[]>([]);
  const [daftarData, setDaftarData] = useState<DaftarData[]>([]);
  const [tahunAktif, setTahunAktif] = useState<number[]>(TAHUN_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(
    () =>
      loadOverviewData()
        .then(([layersRes, opdsRes, daftarRes, tahun]) => {
          if (!layersRes.error) setLayers(layersRes.data);
          if (opdsRes.data) setOpds(opdsRes.data);
          if (!daftarRes.error) setDaftarData(daftarRes.data);
          setTahunAktif(tahun);
          setLoadError(layersRes.error || opdsRes.error || daftarRes.error ? DB_UNREACHABLE_MESSAGE : null);
        })
        .catch((err) => {
          console.error("Error loading overview analytics:", err);
          setLoadError(DB_UNREACHABLE_MESSAGE);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Overall KPIs
  const totalLayers = layers.length;
  const totalOpds = opds.length;
  const totalDaftar = daftarData.length;

  const totalFilled = useMemo(() => {
    return daftarData.filter((d) => d.status_keterisian).length;
  }, [daftarData]);

  const overallFilledPercent = useMemo(() => {
    if (totalDaftar === 0) return 0;
    return Math.round((totalFilled / totalDaftar) * 100);
  }, [totalDaftar, totalFilled]);

  const totalKugi = useMemo(() => {
    return daftarData.filter((d) => Boolean(d.kugi_id || d.kugi_nama_unsur)).length;
  }, [daftarData]);

  const overallKugiPercent = useMemo(() => {
    if (totalDaftar === 0) return 0;
    return Math.round((totalKugi / totalDaftar) * 100);
  }, [totalDaftar, totalKugi]);

  // Chart 1: Geometry Distribution
  const geometryData = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach((l) => {
      const g = l.geometry_type ? l.geometry_type.trim() : "Tidak Diketahui";
      counts[g] = (counts[g] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [layers]);

  // Chart 2: SRID Distribution
  const sridData = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach((l) => {
      let s = l.srid ? l.srid.trim() : "Tidak Diketahui";
      if (s.toLowerCase().includes("4326") || s.toLowerCase().includes("wgs")) {
        s = "EPSG:4326 (WGS 84)";
      }
      counts[s] = (counts[s] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [layers]);

  // Yearly Progress Comparison
  const yearlyData = useMemo(() => {
    return tahunAktif.map((yr) => {
      const yearRows = daftarData.filter(
        (d) => Array.isArray(d.tahun_berlaku) && d.tahun_berlaku.includes(yr)
      );
      const filled = yearRows.filter((d) => d.status_keterisian).length;
      return {
        year: `Tahun ${yr}`,
        total: yearRows.length,
        terisi: filled,
        belum: yearRows.length - filled,
      };
    });
  }, [daftarData, tahunAktif]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar currentPage="overview" />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        <DbErrorBanner message={loadError} />
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              JIGD Kaltim
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Overview &amp; Statistik Geospasial
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Visualisasi komprehensif sebaran tipe data vektor, sistem koordinat, dan kepatuhan keterisian data per OPD.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/produsen">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium"
              >
                <Building2 className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
                Daftar OPD
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-2xs"
              >
                <FileCheck2 className="h-4 w-4 mr-1.5" />
                Verifikasi Layer
              </Button>
            </Link>
          </div>
        </div>

        {/* Top 4 KPI Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Card 1: Total Produsen Data */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
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
                {totalOpds}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center justify-between">
                <span>Perangkat Daerah aktif</span>
                <Link href="/produsen" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center">
                  Detail <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Total Layer Geoportal */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Layer Geoportal
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {totalLayers}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center justify-between">
                <span>Layer terpublikasi GeoNode</span>
                <Link href="/datasets" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center">
                  Katalog <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Total Target Data Spasial */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Target Data
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {totalDaftar}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {totalKugi} data ({overallKugiPercent}%) berstandar KUGI
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Keterisian Keseluruhan */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Keterisian Keseluruhan
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                {overallFilledPercent}%
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {totalFilled} dari {totalDaftar} target data terisi
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Charts Section: 2 Columns */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Chart 1: Geometry Distribution */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Sebaran Jenis Data Geometri
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                      Distribusi tipe geometri layer peta yang tersinkronisasi di Geoportal
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading || !isMounted ? (
                <div className="h-[280px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : geometryData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-slate-400">
                  Tidak ada data layer untuk ditampilkan
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={geometryData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 35, bottom: 5 }}
                    >
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(59, 130, 246, 0.05)" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-xs border border-slate-700">
                                <p className="font-semibold">{data.name}</p>
                                <p className="text-blue-300 font-mono mt-0.5">
                                  {data.count} Layer ({Math.round((data.count / totalLayers) * 100)}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {geometryData.map((entry, index) => (
                          <Cell
                            key={`cell-geo-${index}`}
                            fill={GEOMETRY_COLORS[index % GEOMETRY_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2: SRID Distribution */}
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Globe2 className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Sistem Referensi Koordinat (SRID)
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                      Proporsi pemakaian sistem proyeksi dan datum koordinat
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading || !isMounted ? (
                <div className="h-[280px] flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : sridData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-slate-400">
                  Tidak ada data SRID untuk ditampilkan
                </div>
              ) : (
                <div className="h-[280px] w-full flex flex-col sm:flex-row items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sridData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={4}
                      >
                        {sridData.map((entry, index) => (
                          <Cell
                            key={`cell-srid-${index}`}
                            fill={SRID_COLORS[index % SRID_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2.5 bg-slate-900 text-white rounded-lg shadow-lg text-xs border border-slate-700">
                                <p className="font-semibold">{data.name}</p>
                                <p className="text-blue-300 font-mono mt-0.5">
                                  {data.count} Layer ({Math.round((data.count / totalLayers) * 100)}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(val) => (
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            {val}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Section 3: Yearly Progress Trend */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Perbandingan Kemajuan Keterisian Data Antar Tahun
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluasi progres penyediaan dan publikasi data geospasial target {formatDaftarTahun(tahunAktif)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {yearlyData.map((y) => {
              const pct = y.total > 0 ? Math.round((y.terisi / y.total) * 100) : 0;

              return (
                <div
                  key={y.year}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {y.year}
                    </span>
                    <Badge
                      variant="secondary"
                      className="font-semibold text-xs bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                    >
                      {pct}% Terisi
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Terisi: {y.terisi}</span>
                      <span>Target: {y.total}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Sisa data belum terisi: <strong className="text-slate-600 dark:text-slate-300">{y.belum}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
