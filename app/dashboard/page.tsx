"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  RefreshCw,
  Building2,
  Globe2,
  Search,
  ExternalLink,
  Layers,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Calendar,
  MoreHorizontal,
  FileCheck2,
  GitMerge,
  Trash2,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DaftarData, MasterOpd, MasterKugi, CacheLayerGeoportal } from "@/types/database";
import { ManualAddDialog } from "@/components/dashboard/manual-add-dialog";
import { CsvUploadDialog } from "@/components/dashboard/csv-upload-dialog";
import { MergeDataDialog } from "@/components/dashboard/merge-data-dialog";
import { VerificationEditDialog } from "@/components/dashboard/verification-edit-dialog";

function DashboardContent() {
  const searchParams = useSearchParams();
  const opdParam = searchParams.get("opd");

  // Database States
  const [dataList, setDataList] = useState<DaftarData[]>([]);
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [cachedLayers, setCachedLayers] = useState<CacheLayerGeoportal[]>([]);
  const [kugiList, setKugiList] = useState<MasterKugi[]>([]);

  // UI & Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filters & Search
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedOpdId, setSelectedOpdId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Dialog States
  const [editingRecord, setEditingRecord] = useState<DaftarData | null>(null);
  const [mergingRecord, setMergingRecord] = useState<DaftarData | null>(null);

  /**
   * Fetch all database records from Supabase
   */
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Master OPD
      const { data: opdData, error: opdErr } = await supabase
        .from("master_opd")
        .select("*")
        .order("nama_opd", { ascending: true });
      if (opdErr) console.error("Error fetching master_opd:", opdErr);
      else if (opdData) setOpdList(opdData);

      // 2. Fetch Cached Layers
      const { data: layerData, error: layerErr } = await supabase
        .from("cache_layer_geoportal")
        .select("*")
        .order("date_published", { ascending: false });
      if (layerErr) console.error("Error fetching cache_layer_geoportal:", layerErr);
      else if (layerData) setCachedLayers(layerData);

      // 3. Fetch Master KUGI (optimized payload, bypass 1000-row limit)
      const { data: kugiData, error: kugiErr } = await supabase
        .from("master_kugi")
        .select("id, nama_unsur, kode_unsur, katalog_unsur, definisi")
        .limit(10000);
      if (kugiErr) console.error("Error fetching master_kugi:", kugiErr);
      else if (kugiData) setKugiList(kugiData as MasterKugi[]);

      // 4. Fetch Daftar Data with full joined relations
      const { data: daftarRows, error: daftarErr } = await supabase
        .from("daftar_data")
        .select(`
          *,
          master_opd:opd_id ( id, nama_opd, username_jigd ),
          master_kugi:kugi_id ( id, nama_unsur, kode_unsur, katalog_unsur, definisi, instansi_terkait )
        `)
        .order("created_at", { ascending: false });

      if (daftarErr) {
        console.error("Error fetching daftar_data:", daftarErr);
      } else if (daftarRows) {
        setDataList(daftarRows as DaftarData[]);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL search parameter ?opd=
  useEffect(() => {
    if (opdParam && opdList.length > 0) {
      const matched = opdList.find(
        (o) =>
          o.username_jigd?.toLowerCase() === opdParam.toLowerCase() ||
          o.id === opdParam
      );
      if (matched) {
        setSelectedOpdId(matched.id);
      }
    }
  }, [opdParam, opdList]);

  // Reset to page 1 whenever any filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedOpdId, searchQuery, pageSize]);

  /**
   * Trigger GeoNode Sync manually
   */
  const handleSyncGeoNode = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus("Menghubungkan ke GeoNode API JIGD Kaltim...");

      const res = await fetch("/api/sync-jigd");
      const result = await res.json();

      if (result.success) {
        setSyncStatus(`Berhasil sinkron: ${result.synced_count} layer, ${result.opd_count || 0} OPD terdata.`);
        await fetchData();
        setTimeout(() => setSyncStatus(null), 6000);
      } else {
        setSyncStatus(`Gagal sinkron: ${result.error || "Terjadi kesalahan"}`);
      }
    } catch (err) {
      console.error("Sync trigger error:", err);
      setSyncStatus("Gagal menjalankan sinkronisasi.");
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Delete single record
   */
  const handleDeleteRecord = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus data "${name}"?`)) return;

    try {
      const { error } = await supabase.from("daftar_data").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Gagal menghapus data.");
    }
  };

  /**
   * Quick Seed Sample Records (if daftar_data is completely empty)
   */
  const handleSeedSampleData = async () => {
    if (opdList.length === 0) {
      alert("Master OPD belum tersedia. Silakan klik 'Sinkronisasi GeoNode' terlebih dahulu.");
      return;
    }

    try {
      setIsLoading(true);

      const findOpd = (kw: string) =>
        opdList.find(
          (o) =>
            (o.username_jigd && o.username_jigd.toLowerCase().includes(kw)) ||
            (o.nama_opd && o.nama_opd.toLowerCase().includes(kw))
        ) || opdList[0];

      const sampleRecords = [
        {
          nama_data: "Peta Batas Administrasi Provinsi Kalimantan Timur",
          opd_id: findOpd("biropemotda").id,
          tahun_berlaku: [2024, 2025, 2026],
          status_keterisian: true,
          layer_utama_uuid: cachedLayers[0]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Batas Administrasi Kabupaten/Kota",
          opd_id: findOpd("biropemotda").id,
          tahun_berlaku: [2024, 2025, 2026],
          status_keterisian: true,
          layer_utama_uuid: cachedLayers[1]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Jaringan Jalan Kewenangan Provinsi",
          opd_id: findOpd("pupr").id,
          tahun_berlaku: [2024, 2025],
          status_keterisian: true,
          layer_utama_uuid: cachedLayers[2]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Sebaran Jembatan Kewenangan Provinsi",
          opd_id: findOpd("pupr").id,
          tahun_berlaku: [2025, 2026],
          status_keterisian: false,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Kawasan Rawan Bencana Banjir dan Genangan",
          opd_id: findOpd("bpbd").id,
          tahun_berlaku: [2024, 2025, 2026],
          status_keterisian: false,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Kawasan Hutan dan Konservasi",
          opd_id: findOpd("dishut").id,
          tahun_berlaku: [2024, 2025],
          status_keterisian: false,
          layer_pelengkap_uuids: [],
        },
      ];

      const { error } = await supabase.from("daftar_data").insert(sampleRecords);
      if (error) throw error;

      await fetchData();
    } catch (err) {
      console.error("Seed error:", err);
      alert("Gagal memuat data contoh.");
    } finally {
      setIsLoading(false);
    }
  };

  // Map layer UUID to cached layer record for fast lookup
  const layerMap = useMemo(() => {
    const map = new Map<string, CacheLayerGeoportal>();
    cachedLayers.forEach((l) => {
      if (l.uuid) map.set(l.uuid, l);
    });
    return map;
  }, [cachedLayers]);

  // Only OPDs that have at least one layer in cache_layer_geoportal
  const activeGeoportalOpds = useMemo(() => {
    const uploadedOwners = new Set(
      cachedLayers
        .map((l) => l.owner_username?.toLowerCase().trim())
        .filter(Boolean)
    );

    return opdList.filter(
      (opd) =>
        opd.username_jigd &&
        uploadedOwners.has(opd.username_jigd.toLowerCase().trim())
    );
  }, [opdList, cachedLayers]);

  // Dynamically extract all available years
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2024, 2025, 2026]);
    dataList.forEach((d) => {
      if (Array.isArray(d.tahun_berlaku)) {
        d.tahun_berlaku.forEach((y) => yearsSet.add(y));
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [dataList]);

  // Filtered dataset logic (Tahun + OPD + Search)
  const filteredData = useMemo(() => {
    return dataList.filter((item) => {
      // 1. Year Filter
      const matchYear =
        selectedYear === "all" ||
        (Array.isArray(item.tahun_berlaku) &&
          item.tahun_berlaku.includes(parseInt(selectedYear, 10)));

      // 2. OPD Filter
      const matchOpd =
        selectedOpdId === "all" || item.opd_id === selectedOpdId;

      const query = searchQuery.toLowerCase().trim();
      const opdName = item.master_opd?.nama_opd?.toLowerCase() || "";
      const opdUser = item.master_opd?.username_jigd?.toLowerCase() || "";
      const kugiName = item.master_kugi?.nama_unsur?.toLowerCase() || item.kugi_nama_unsur?.toLowerCase() || "";
      const kugiCode = item.master_kugi?.kode_unsur?.toLowerCase() || "";
      const dataName = item.nama_data.toLowerCase();

      const matchSearch =
        !query ||
        dataName.includes(query) ||
        opdName.includes(query) ||
        opdUser.includes(query) ||
        kugiName.includes(query) ||
        kugiCode.includes(query);

      return matchYear && matchOpd && matchSearch;
    });
  }, [dataList, selectedYear, selectedOpdId, searchQuery]);

  // Pagination Slicing
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredData.slice(startIdx, startIdx + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const startIndex = filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredData.length);

  // Overview metrics calculations
  const totalDatasetsGeoportal = cachedLayers.length;

  // Dynamically extract latest year (defaulting to 2026)
  const latestYear = useMemo(() => {
    if (availableYears.length > 0) {
      return Math.max(...availableYears);
    }
    return 2026;
  }, [availableYears]);

  // Data for the latest year
  const latestYearData = useMemo(() => {
    return dataList.filter(
      (d) => Array.isArray(d.tahun_berlaku) && d.tahun_berlaku.includes(latestYear)
    );
  }, [dataList, latestYear]);

  // Latest year filled count and percentage
  const latestYearFilled = useMemo(() => {
    return latestYearData.filter((d) => d.status_keterisian).length;
  }, [latestYearData]);

  const latestYearFilledPercent = useMemo(() => {
    if (latestYearData.length === 0) return 0;
    return Math.round((latestYearFilled / latestYearData.length) * 100);
  }, [latestYearData, latestYearFilled]);

  // Latest year KUGI standardized count and percentage
  const latestYearKugiStandardized = useMemo(() => {
    return latestYearData.filter((d) => Boolean(d.kugi_id || d.kugi_nama_unsur)).length;
  }, [latestYearData]);

  const latestYearKugiPercent = useMemo(() => {
    if (latestYearData.length === 0) return 0;
    return Math.round((latestYearKugiStandardized / latestYearData.length) * 100);
  }, [latestYearData, latestYearKugiStandardized]);

  const totalFilled = filteredData.filter((d) => d.status_keterisian).length;
  const percentageFilled =
    filteredData.length > 0 ? Math.round((totalFilled / filteredData.length) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar currentPage="dashboard" />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        {/* Top Header & Primary Action Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              JIGD Kaltim
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Dashboard Monitoring Keterisian JIGD
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Kelola daftar data, verifikasi integrasi layer Geoportal, dan petakan standar KUGI.
            </p>
          </div>

          {/* Action Buttons: Tambah Data, CSV Upload, Sync GeoNode */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncGeoNode}
              disabled={isSyncing}
              className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs font-medium"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sinkronisasi..." : "Sinkronisasi GeoNode"}
            </Button>

            <CsvUploadDialog opdList={opdList} onSuccess={fetchData} />

            <ManualAddDialog opdList={opdList} kugiList={kugiList} onSuccess={fetchData} />
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatus && (
          <div className="mb-6 p-3.5 bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{syncStatus}</span>
            </div>
            <button onClick={() => setSyncStatus(null)} className="text-blue-800 dark:text-blue-300 hover:text-blue-950 dark:hover:text-white font-bold cursor-pointer">
              ×
            </button>
          </div>
        )}

        {/* 1. OVERVIEW SECTION (4 STAT CARDS) */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Overview Indikator Keterisian
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Database Supabase Terhubung
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat Card 1: Total Dataset JIGD */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Total Dataset JIGD
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Database className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                  {totalDatasetsGeoportal}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                  Layer aktif pada cache Geoportal
                </p>
              </CardContent>
            </Card>

            {/* Stat Card 2: Daftar Data (Tahun Terakhir) */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Daftar Data ({latestYear})
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                  {latestYearData.length}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Target data spasial tahun {latestYear}
                </p>
              </CardContent>
            </Card>

            {/* Stat Card 3: Data Terisi */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Data Terisi ({latestYear})
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                  {latestYearFilled}
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  {latestYearFilledPercent}% dari target tahun {latestYear}
                </p>
              </CardContent>
            </Card>

            {/* Stat Card 4: Persentase Pemetaan KUGI */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Persentase Pemetaan KUGI
                </CardTitle>
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                  {latestYearKugiPercent}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {latestYearKugiStandardized} dari {latestYearData.length} data berstandar KUGI
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 2. DATA TABLE SECTION */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Header & Multi-Filter Controls */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Daftar Data Geospasial
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring status keterisian, standar KUGI, dan verifikasi layer per Organisasi Perangkat Daerah
              </p>
            </div>

            {/* Controls: Search, Filter OPD, Filter Tahun */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari data, OPD, atau KUGI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
                />
              </div>

              {/* Filter OPD Dropdown */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  id="filter-opd"
                  value={selectedOpdId}
                  onChange={(e) => setSelectedOpdId(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer truncate text-left max-w-[200px]"
                >
                  <option value="all">Semua Perangkat Daerah</option>
                  {activeGeoportalOpds.map((opd) => (
                    <option key={opd.id} value={opd.id}>
                      {opd.nama_opd} {opd.username_jigd ? `(@${opd.username_jigd})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tahun Dropdown */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  id="filter-tahun"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
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
            </div>
          </div>

          {/* Table Summary Quick Bar */}
          <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-3">
              <span>
                Total Ditemukan: <strong className="text-slate-900 dark:text-slate-100">{filteredData.length}</strong> data
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Terisi: {totalFilled} ({percentageFilled}%)
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Belum Terisi: {filteredData.length - totalFilled}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedOpdId !== "all" && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 text-[11px] font-medium truncate max-w-[200px]">
                  OPD: {opdList.find(o => o.id === selectedOpdId)?.nama_opd || "Terfilter"}
                </Badge>
              )}
              {selectedYear !== "all" && (
                <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-medium">
                  Tahun: {selectedYear}
                </Badge>
              )}
            </div>
          </div>

          {/* Loading or Empty State */}
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Memuat data dari Supabase...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
                <FileSpreadsheet className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {dataList.length === 0 ? "Belum Ada Data di Tabel daftar_data" : "Tidak Ada Data yang Cocok"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {dataList.length === 0
                    ? "Anda dapat mengunggah file CSV daftar data, menambahkan data manual satu per satu, atau memuat data contoh untuk simulasi."
                    : "Coba ubah kata kunci pencarian, atau bersihkan filter OPD dan Tahun."}
                </p>
              </div>

              {dataList.length === 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <CsvUploadDialog opdList={opdList} onSuccess={fetchData} />
                  <ManualAddDialog opdList={opdList} kugiList={kugiList} onSuccess={fetchData} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSeedSampleData}
                    className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                    Muat 6 Data Contoh
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* The Complete Data Table with 5 Exact Columns */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    {/* Column 1: Perangkat Daerah */}
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-xs py-3.5 pl-5 min-w-[250px] whitespace-normal">
                      Perangkat Daerah
                    </TableHead>
                    {/* Column 2: Daftar Data Geospasial */}
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-xs py-3.5 min-w-[250px] whitespace-normal">
                      Daftar Data Geospasial
                    </TableHead>
                    {/* Column 3: Standar KUGI */}
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-xs py-3.5 min-w-[180px] whitespace-normal">
                      Standar KUGI
                    </TableHead>
                    {/* Column 4: Status */}
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-xs py-3.5 text-center min-w-[120px]">
                      Status
                    </TableHead>
                    {/* Column 5: Aksi */}
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-xs py-3.5 pr-5 text-right min-w-[100px]">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item) => {
                    const primaryLayer = item.layer_utama_uuid ? layerMap.get(item.layer_utama_uuid) : null;
                    const datasetUrl = primaryLayer
                      ? `https://jigd.kaltimprov.go.id/catalogue/#/dataset/${primaryLayer.id_dataset}`
                      : null;
                    const pelengkapLayers = (item.layer_pelengkap_uuids || [])
                      .map((uuid) => layerMap.get(uuid))
                      .filter(Boolean) as CacheLayerGeoportal[];

                    return (
                      <TableRow
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Perangkat Daerah: whitespace-normal break-words min-w-[250px] */}
                        <TableCell className="py-3.5 pl-5 align-top whitespace-normal break-words min-w-[250px]">
                          <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                            {item.master_opd?.nama_opd || "OPD Belum Terhubung"}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.master_opd?.username_jigd && (
                              <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50/80 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800 py-0 font-mono">
                                @{item.master_opd.username_jigd}
                              </Badge>
                            )}
                            {(item.tahun_berlaku || []).map((th) => (
                              <span key={th} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-medium px-1.5 py-0.5 rounded">
                                {th}
                              </span>
                            ))}
                          </div>
                        </TableCell>

                        {/* 2. Daftar Data Geospasial: whitespace-normal break-words min-w-[250px] */}
                        <TableCell className="py-3.5 align-top whitespace-normal break-words min-w-[250px]">
                          <div className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-relaxed">
                            {item.nama_data}
                          </div>
                          {primaryLayer ? (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all">
                                {primaryLayer.name} ({primaryLayer.geometry_type || "Layer"})
                              </span>
                              <a
                                href={datasetUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                                title="Buka layer di Geoportal"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic mt-0.5">
                              Belum ada layer terpaut
                            </div>
                          )}

                          {/* Supplementary Layers (Layer Pelengkap) collapsible */}
                          {pelengkapLayers.length > 0 && (
                            <details className="group mt-2 text-xs">
                              <summary className="cursor-pointer text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 select-none list-none flex items-center gap-1">
                                <span className="text-[9px] transition-transform duration-150 group-open:rotate-90 text-slate-400">▶</span>
                                <span>+ {pelengkapLayers.length} Layer Pelengkap</span>
                              </summary>
                              <ul className="mt-1.5 pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-1">
                                {pelengkapLayers.map((pLayer) => (
                                  <li key={pLayer.uuid} className="text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">{pLayer.title}</span>
                                      <span className="text-[10px] font-mono text-slate-400">({pLayer.name})</span>
                                      {pLayer.id_dataset && (
                                        <a
                                          href={`https://jigd.kaltimprov.go.id/catalogue/#/dataset/${pLayer.id_dataset}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
                                          title="Buka di Geoportal"
                                        >
                                          <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                                        </a>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </TableCell>

                        {/* 3. Standar KUGI: whitespace-normal break-words */}
                        <TableCell className="py-3.5 align-top text-xs text-slate-700 dark:text-slate-300 whitespace-normal break-words min-w-[180px]">
                          {item.master_kugi?.nama_unsur ? (
                            <div>
                              <Badge variant="secondary" className="font-semibold text-xs leading-normal py-0.5 px-2">
                                {item.master_kugi.nama_unsur}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground mt-1 block">
                                {item.master_kugi.kode_unsur}
                              </span>
                            </div>
                          ) : item.kugi_nama_unsur ? (
                            <div>
                              <Badge variant="secondary" className="font-semibold text-xs leading-normal py-0.5 px-2">
                                {item.kugi_nama_unsur}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground mt-1 block">
                                (Kode belum ditentukan)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Belum dipetakan
                            </span>
                          )}
                        </TableCell>

                        {/* 4. Status (Red / Green Badge) */}
                        <TableCell className="py-3.5 align-top text-center">
                          {item.status_keterisian ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              Terisi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              Belum Terisi
                            </span>
                          )}
                        </TableCell>

                        {/* 5. Aksi: Action Menu (DropdownMenu with "Verifikasi Data" and "Merge dengan Data Lain") */}
                        <TableCell className="py-3.5 pr-5 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                                >
                                  <span>Aksi</span>
                                  <MoreHorizontal className="h-3.5 w-3.5 ml-1 text-slate-500 dark:text-slate-400" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                              {/* Option 1: Verifikasi Data */}
                              <DropdownMenuItem
                                onClick={() => setEditingRecord(item)}
                                className="cursor-pointer text-xs focus:bg-slate-100 dark:focus:bg-slate-800"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 mr-2 text-blue-600 dark:text-blue-400" />
                                <span>Verifikasi Data</span>
                              </DropdownMenuItem>

                              {/* Option 2: Merge dengan Data Lain */}
                              <DropdownMenuItem
                                onClick={() => setMergingRecord(item)}
                                className="cursor-pointer text-xs focus:bg-slate-100 dark:focus:bg-slate-800"
                              >
                                <GitMerge className="h-3.5 w-3.5 mr-2 text-cyan-600 dark:text-cyan-400" />
                                <span>Merge dengan Data Lain</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />

                              {/* Delete Option */}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteRecord(item.id, item.nama_data)}
                                className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                <span>Hapus Data</span>
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

          {/* Pagination Controls & Rows Per Page Selector */}
          {!isLoading && filteredData.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
              {/* Row count range */}
              <div>
                Menampilkan <strong className="text-slate-900 dark:text-slate-100">{startIndex}</strong> - <strong className="text-slate-900 dark:text-slate-100">{endIndex}</strong> dari <strong className="text-slate-900 dark:text-slate-100">{filteredData.length}</strong> data
              </div>

              {/* Pagination controls & Page Size */}
              <div className="flex items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <span>Tampilkan:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-8 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per halaman</span>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Sebelumnya
                  </Button>

                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    Selanjutnya
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Keterangan: Integrasi layer diverifikasi langsung dengan database cache Geoportal Provinsi Kalimantan Timur.
            </span>
            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              Supabase Status: Aktif &amp; Sinkron
            </span>
          </div>
        </section>
      </main>

      {/* Verification & Edit Dialog Modal */}
      <VerificationEditDialog
        record={editingRecord}
        isOpen={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        allCachedLayers={cachedLayers}
        allKugi={kugiList}
        onSuccess={fetchData}
      />

      {/* Merge Data Dialog Modal */}
      <MergeDataDialog
        sourceRecord={mergingRecord}
        isOpen={Boolean(mergingRecord)}
        onClose={() => setMergingRecord(null)}
        allRecords={dataList}
        onSuccess={fetchData}
      />

      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
