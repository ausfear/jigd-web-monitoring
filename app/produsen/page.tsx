"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DbErrorBanner } from "@/components/db-error-banner";
import { SyncButton } from "@/components/sync-button";
import { LastSyncInfo } from "@/components/last-sync-info";
import { FillBar, PageHeader, StatStrip, controlClass } from "@/components/lembar-peta";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useQueryParams, useDebouncedQueryText } from "@/lib/use-query-params";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  FileCheck2,
  MoreHorizontal,
  Database,
  Loader2,
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

/** Bar keterisian satu OPD (warna terisi sama dengan kotak status di seluruh situs). */
function ProgressKeterisian({ filled, total, percent }: { filled: number; total: number; percent: number }) {
  return (
    <div className="flex items-center gap-3">
      <FillBar percent={percent} size="sm" animate={false} className="w-full max-w-[180px]" label={`${filled} dari ${total} terisi`} />
      <span className="w-11 shrink-0 text-right text-sm tabular-nums">{percent}%</span>
    </div>
  );
}

function ProdusenContent() {
  const router = useRouter();
  const { searchParams, setParams } = useQueryParams();
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [dataList, setDataList] = useState<DaftarData[]>([]);
  const [cachedLayers, setCachedLayers] = useState<CacheLayerGeoportal[]>([]);
  const [tahunAktif, setTahunAktif] = useState<number[]>(TAHUN_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters (null = tahun aktif terbaru)
  // Filter disimpan di URL: ?tahun=&q=&semua=1 (tanpa ?tahun = tahun aktif terbaru)
  const [searchQuery, setSearchQuery] = useDebouncedQueryText("q", searchParams.get("q") ?? "", setParams);
  const selectedYear = searchParams.get("tahun") ?? String(Math.max(...tahunAktif));
  const showActiveOnly = searchParams.get("semua") !== "1";

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
    <div className="flex flex-1 flex-col">

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-10 pt-9 pb-16">
        <DbErrorBanner message={loadError} />
        <PageHeader
          meta={<LastSyncInfo />}
          title="Produsen data geospasial"
          description="Kesiapan daftar data, pemetaan KUGI, dan layer yang sudah terbit di Geoportal untuk setiap perangkat daerah."
          actions={
            <>
              <SyncButton onSynced={fetchData} />
              <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 border-ink bg-transparent px-3 text-sm text-ink hover:bg-ink/5")}>
                Buka verifikasi data
              </Link>
            </>
          }
        />

        <StatStrip
          loading={isLoading}
          items={[
            { label: "OPD dengan daftar data", value: activeOpdCount, note: `Tahun ${selectedYear === "all" ? "semua" : selectedYear}` },
            { label: "Daftar data", value: totalTargetAll, note: selectedYear === "all" ? "Semua tahun" : `Target tahun ${selectedYear}` },
            { label: "Keterisian", value: `${avgPercent}%`, note: `${totalFilledAll} dari ${totalTargetAll} sudah punya layer` },
            { label: "OPD terisi penuh", value: completeOpdCount, note: "Semua daftar datanya sudah terisi" },
          ]}
        />

        {/* Produsen Table Section */}
        <section className="border-y-2 border-ink bg-sheet">
          {/* Filter Bar */}
          <div className="px-4 py-4 sm:px-5 border-b border-ink flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div>
              <h2 className="font-cond text-[21px] font-bold">Perangkat daerah</h2>
              <p className="text-sm text-ink-2 mt-0.5">Urut menurut nama. Klik ⋯ untuk membuka layer atau verifikasi OPD.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2" />
                <Input
                  type="text"
                  placeholder="Cari nama OPD atau akun..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-sheet border-ink/40 focus-visible:ring-qty/30"
                />
              </div>

              {/* Year Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Tahun"
                  id="filter-year-produsen"
                  value={selectedYear}
                  onChange={(e) => setParams({ tahun: e.target.value })}
                  className={cn(controlClass, "pr-8 cursor-pointer")}
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
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showActiveOnly}
                  onChange={(e) => setParams({ semua: e.target.checked ? null : "1" })}
                  className="h-3.5 w-3.5 rounded border-ink/30 text-qty focus:ring-qty/30 cursor-pointer accent-qty"
                />
                <span className="whitespace-nowrap">Hanya OPD yang punya daftar data</span>
              </label>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <SkeletonRows rows={10} />
          ) : filteredOpds.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
              <Building2 className="h-10 w-10 text-ink-2/60" />
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-ink mb-1">
                  Tidak ada OPD yang cocok
                </h4>
                <p className="text-xs text-ink-2 mb-4">
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
                <TableHeader>
                  <TableRow className="border-b border-ink hover:bg-transparent">
                    <TableHead className="hidden sm:table-cell w-[50px] text-center font-cond font-semibold">No.</TableHead>
                    <TableHead className="lg:min-w-[280px] font-cond font-semibold">Perangkat daerah</TableHead>
                    <TableHead className="hidden md:table-cell lg:min-w-[110px] font-cond font-semibold text-right">Daftar data</TableHead>
                    <TableHead className="hidden md:table-cell lg:min-w-[110px] font-cond font-semibold text-right">Layer di Geoportal</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[160px] lg:min-w-[240px] font-cond font-semibold pl-8">Keterisian</TableHead>
                    <TableHead className="w-[60px] md:w-[80px] text-center font-cond font-semibold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="animate-reveal">
                  {filteredOpds.map((opd, idx) => {
                    const opdParam = opd.username_jigd || opd.id;

                    return (
                      <TableRow
                        key={opd.id}
                        className="border-b border-rule hover:bg-qty/5 transition-colors"
                      >
                        {/* Index */}
                        <TableCell className="hidden sm:table-cell text-center text-sm text-contour tabular-nums">
                          {idx + 1}
                        </TableCell>

                        {/* OPD Name & Username */}
                        <TableCell className="py-3 whitespace-normal">
                          <div className="text-sm text-ink">{opd.nama_opd}</div>
                          <div className="mt-0.5 text-[13px] text-ink-2">
                            {opd.filledCount} dari {opd.totalTarget} terisi
                            {opd.username_jigd && <span className="hidden sm:inline">, @{opd.username_jigd}</span>}
                          </div>

                          {/* Ringkasan untuk layar kecil (kolom lain disembunyikan) */}
                          <div className="md:hidden mt-2.5 space-y-2">
                            <div className="text-[13px] text-ink-2">
                              {opd.layerCount} layer di Geoportal
                            </div>
                            <ProgressKeterisian filled={opd.filledCount} total={opd.totalTarget} percent={opd.percent} />
                          </div>
                        </TableCell>

                        {/* Total Daftar Data */}
                        <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">
                          {opd.totalTarget}
                        </TableCell>

                        {/* Total Layer Geoportal */}
                        <TableCell className="hidden md:table-cell text-right text-sm tabular-nums">
                          {opd.layerCount}
                        </TableCell>

                        {/* Progress Keterisian */}
                        <TableCell className="hidden md:table-cell pl-8">
                          <ProgressKeterisian filled={opd.filledCount} total={opd.totalTarget} percent={opd.percent} />
                        </TableCell>

                        {/* Action Menu */}
                        <TableCell className="text-center align-top md:align-middle">
                          <DropdownMenu>
                            <DropdownMenuTrigger aria-label={`Aksi untuk ${opd.nama_opd}`} className="inline-flex items-center justify-center h-8 w-8 border border-transparent text-ink-2 hover:text-ink hover:border-ink/40 transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem
                                onClick={() => router.push(`/datasets?opd=${encodeURIComponent(opdParam)}`)}
                                className="flex items-center gap-2 cursor-pointer text-xs"
                              >
                                <Database className="h-3.5 w-3.5 text-qty" />
                                <span>Lihat Layer di Katalog</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/dashboard?opd=${encodeURIComponent(opdParam)}`)}
                                className="flex items-center gap-2 cursor-pointer text-xs"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 text-qty" />
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
          <div className="px-4 py-3 sm:px-5 border-t border-ink flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm text-ink-2">
            <span>
              {filteredOpds.length} perangkat daerah{showActiveOnly ? " yang punya daftar data" : ""}
            </span>
            <span>Tahun {selectedYear === "all" ? "semua" : selectedYear}</span>
          </div>
        </section>
      </main>

    </div>
  );
}

export default function ProdusenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-qty" />
        </div>
      }
    >
      <ProdusenContent />
    </Suspense>
  );
}
