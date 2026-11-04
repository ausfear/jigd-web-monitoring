"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { DbErrorBanner } from "@/components/db-error-banner";
import { SyncButton } from "@/components/sync-button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { PageHeader, StatStrip, StatusLabel, Swatch, controlClass } from "@/components/lembar-peta";
import { cn } from "@/lib/utils";
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
  Search,
  ExternalLink,
  MoreHorizontal,
  FileCheck2,
  GitMerge,
  Trash2,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  TriangleAlert,
  Settings2,
  ChevronDown,
  PlusCircle,
  Upload,
  ArrowUpDown,
  FileDown,
  History,
  CalendarCog,
  ListChecks,
} from "lucide-react";
import { supabase, fetchAllRows, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";
import { fetchTahunAktif, TAHUN_DEFAULT } from "@/lib/tahun";
import { useQueryParams, useDebouncedQueryText, readPageParam } from "@/lib/use-query-params";
import { DaftarData, MasterOpd, MasterKugi, CacheLayerGeoportal, UsulanMerge } from "@/types/database";
import { ManualAddDialog } from "@/components/dashboard/manual-add-dialog";
import { CsvUploadDialog } from "@/components/dashboard/csv-upload-dialog";
import { MergeDataDialog } from "@/components/dashboard/merge-data-dialog";
import { VerificationEditDialog } from "@/components/dashboard/verification-edit-dialog";
import { YearSettingsDialog } from "@/components/dashboard/year-settings-dialog";
import { ReportDownloadDialog } from "@/components/dashboard/report-download-dialog";
import { OrderDialog } from "@/components/dashboard/order-dialog";
import { MergeSuggestionsDialog } from "@/components/dashboard/merge-suggestions-dialog";
import { HistoryDialog } from "@/components/dashboard/history-dialog";
import { BulkEditDialog } from "@/components/dashboard/bulk-edit-dialog";

/**
 * Ambil seluruh data dashboard dari Supabase secara paralel (tabel besar diambil per 1.000 baris).
 * Sengaja di luar komponen: fungsi ini tidak menyentuh state React.
 */
async function loadDashboardData() {
  const [opd, layers, kugi, daftar, tahun, usulan] = await Promise.all([
    supabase.from("master_opd").select("*").order("nama_opd", { ascending: true }),
    fetchAllRows<CacheLayerGeoportal>((from, to) =>
      supabase
        .from("cache_layer_geoportal")
        .select("*")
        .order("date_published", { ascending: false })
        .order("id_dataset", { ascending: true })
        .range(from, to)
    ),
    // Master KUGI (optimized payload)
    fetchAllRows<MasterKugi>((from, to) =>
      supabase
        .from("master_kugi")
        .select("id, nama_unsur, kode_unsur, katalog_unsur, definisi")
        .order("id", { ascending: true })
        .range(from, to)
    ),
    // Daftar Data with full joined relations
    fetchAllRows<DaftarData>((from, to) =>
      supabase
        .from("daftar_data")
        .select(`
          *,
          master_opd:opd_id ( id, nama_opd, username_jigd ),
          master_kugi:kugi_id ( id, nama_unsur, kode_unsur, katalog_unsur, definisi, instansi_terkait )
        `)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchTahunAktif(),
    supabase.from("usulan_merge").select("*").order("created_at", { ascending: true }).returns<UsulanMerge[]>(),
  ]);

  // Sort by spreadsheet order (urutan) first; rows without urutan go last, newest first.
  const sortedDaftar = [...daftar.data].sort((a, b) => {
    const ua = a.urutan ?? Number.POSITIVE_INFINITY;
    const ub = b.urutan ?? Number.POSITIVE_INFINITY;
    if (ua !== ub) return ua - ub;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });

  return { opd, layers, kugi, daftar: { ...daftar, data: sortedDaftar }, tahun, usulan };
}

/** Chip filter aktif. Nama OPD yang panjang turun ke baris berikutnya, bukan terpotong. */
function FilterChip({
  label,
  value,
  onRemove,
  className,
}: {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-start gap-1 py-0.5 pl-2 pr-0.5 text-[13px] leading-snug ${className ?? ""}`}
    >
      <span className="min-w-0 break-words">
        {label}: {value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus filter ${label}`}
        title={`Hapus filter ${label}`}
        className="shrink-0 p-0.5 text-ink-2 hover:text-ink hover:bg-ink/10 cursor-pointer"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function DashboardContent() {
  const { searchParams, setParams } = useQueryParams();
  const opdParam = searchParams.get("opd");

  // Database States
  const [dataList, setDataList] = useState<DaftarData[]>([]);
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [cachedLayers, setCachedLayers] = useState<CacheLayerGeoportal[]>([]);
  const [kugiList, setKugiList] = useState<MasterKugi[]>([]);
  const [tahunAktif, setTahunAktif] = useState<number[]>(TAHUN_DEFAULT);

  // UI & Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search (disimpan di URL: ?opd=&tahun=&q=&page=)
  const selectedYear = searchParams.get("tahun") ?? "all";
  const onlyMissingLayer = searchParams.get("hilang") === "1";
  const [searchQuery, setSearchQuery] = useDebouncedQueryText("q", searchParams.get("q") ?? "", setParams);

  // Pagination States
  const [pageSize, setPageSize] = useState<number>(10);

  // Filter OPD mengikuti parameter URL ?opd= (username_jigd atau id OPD)
  const selectedOpd = useMemo(() => {
    if (!opdParam) return "all";
    const matched = opdList.find(
      (o) =>
        o.username_jigd?.toLowerCase() === opdParam.toLowerCase() ||
        o.id === opdParam
    );
    return matched ? matched.username_jigd?.toLowerCase() || matched.id : "all";
  }, [opdParam, opdList]);

  // Dialog States
  const [editingRecord, setEditingRecord] = useState<DaftarData | null>(null);
  const [mergingRecord, setMergingRecord] = useState<DaftarData | null>(null);
  // Target merge yang langsung terpilih (saat dibuka dari Usulan merge)
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [usulanList, setUsulanList] = useState<UsulanMerge[]>([]);
  // Dialog yang dibuka dari menu Pengaturan
  const [menuDialog, setMenuDialog] = useState<
    null | "tambah" | "csv" | "urutan" | "usulan" | "laporan" | "riwayat" | "tahun" | "bulk"
  >(null);
  // Mode pilih untuk bulk action: pilihan bertahan saat pindah halaman atau mengganti filter
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (ids: string[], on: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const menuDialogProps = (key: NonNullable<typeof menuDialog>) => ({
    open: menuDialog === key,
    onOpenChange: (open: boolean) => setMenuDialog(open ? key : null),
  });

  /**
   * Fetch all database records from Supabase.
   * Tidak menyalakan spinner: pemuatan pertama sudah diawali isLoading = true,
   * dan muat ulang setelah edit/sinkronisasi cukup memperbarui tabel tanpa berkedip.
   */
  const fetchData = useCallback(
    () =>
      loadDashboardData()
        .then(({ opd, layers, kugi, daftar, tahun, usulan }) => {
          if (opd.error) console.error("Error fetching master_opd:", opd.error);
          else setOpdList(opd.data ?? []);

          if (layers.error) console.error("Error fetching cache_layer_geoportal:", layers.error);
          else setCachedLayers(layers.data);

          if (kugi.error) console.error("Error fetching master_kugi:", kugi.error);
          else setKugiList(kugi.data);

          if (daftar.error) console.error("Error fetching daftar_data:", daftar.error);
          else setDataList(daftar.data);

          setTahunAktif(tahun);
          // Tabel usulan_merge bisa belum ada (migrasi belum dijalankan): anggap kosong.
          setUsulanList(usulan.error ? [] : usulan.data ?? []);
          setLoadError(opd.error || layers.error || kugi.error || daftar.error ? DB_UNREACHABLE_MESSAGE : null);
        })
        .catch((err) => {
          console.error("Error loading dashboard data:", err);
          setLoadError(DB_UNREACHABLE_MESSAGE);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      alert("Master OPD belum tersedia. Silakan klik 'Sinkronisasi JIGD' terlebih dahulu.");
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
          tahun_berlaku: tahunAktif,
          status_keterisian: Boolean(cachedLayers[0]?.uuid),
          layer_utama_uuid: cachedLayers[0]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Batas Administrasi Kabupaten/Kota",
          opd_id: findOpd("biropemotda").id,
          tahun_berlaku: tahunAktif,
          status_keterisian: Boolean(cachedLayers[1]?.uuid),
          layer_utama_uuid: cachedLayers[1]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Jaringan Jalan Kewenangan Provinsi",
          opd_id: findOpd("pupr").id,
          tahun_berlaku: tahunAktif,
          status_keterisian: Boolean(cachedLayers[2]?.uuid),
          layer_utama_uuid: cachedLayers[2]?.uuid || null,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Sebaran Jembatan Kewenangan Provinsi",
          opd_id: findOpd("pupr").id,
          tahun_berlaku: tahunAktif,
          status_keterisian: false,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Kawasan Rawan Bencana Banjir dan Genangan",
          opd_id: findOpd("bpbd").id,
          tahun_berlaku: tahunAktif,
          status_keterisian: false,
          layer_pelengkap_uuids: [],
        },
        {
          nama_data: "Peta Kawasan Hutan dan Konservasi",
          opd_id: findOpd("dishut").id,
          tahun_berlaku: tahunAktif,
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

  // Daftar data yang merujuk layer yang sudah tidak ada di cache Geoportal (dihapus atau
  // diunggah ulang di GeoNode lalu tersapu sinkronisasi). Statusnya masih "Terisi" sampai
  // layer penggantinya dipilih lewat Verifikasi.
  const missingLayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (layerMap.size === 0) return ids;
    dataList.forEach((d) => {
      const refs = [d.layer_utama_uuid, ...(d.layer_pelengkap_uuids || [])];
      if (refs.some((uuid) => uuid && !layerMap.has(uuid))) ids.add(d.id);
    });
    return ids;
  }, [dataList, layerMap]);

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

  // Pilihan filter tahun: tahun aktif ditambah tahun lain yang masih tercatat di data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>(tahunAktif);
    dataList.forEach((d) => {
      if (Array.isArray(d.tahun_berlaku)) {
        d.tahun_berlaku.forEach((y) => yearsSet.add(y));
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [dataList, tahunAktif]);

  // Dynamically extract all unique tag_bidang values
  const availableTags = useMemo(() => {
    return Array.from(
      new Set(
        dataList
          .map((d) => d.tag_bidang?.trim())
          .filter((t): t is string => Boolean(t))
      )
    ).sort((a, b) => a.localeCompare(b));
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
        selectedOpd === "all" ||
        item.opd_id === selectedOpd ||
        (item.master_opd?.username_jigd &&
          item.master_opd.username_jigd.toLowerCase() === selectedOpd.toLowerCase());

      const query = searchQuery.toLowerCase().trim();
      const opdName = item.master_opd?.nama_opd?.toLowerCase() || "";
      const opdUser = item.master_opd?.username_jigd?.toLowerCase() || "";
      const kugiName = item.master_kugi?.nama_unsur?.toLowerCase() || item.kugi_nama_unsur?.toLowerCase() || "";
      const kugiCode = item.master_kugi?.kode_unsur?.toLowerCase() || "";
      const tagBidang = item.tag_bidang?.toLowerCase() || "";
      const dataName = item.nama_data.toLowerCase();

      const matchSearch =
        !query ||
        dataName.includes(query) ||
        opdName.includes(query) ||
        opdUser.includes(query) ||
        kugiName.includes(query) ||
        kugiCode.includes(query) ||
        tagBidang.includes(query);

      const matchMissing = !onlyMissingLayer || missingLayerIds.has(item.id);

      return matchYear && matchOpd && matchSearch && matchMissing;
    });
  }, [dataList, selectedYear, selectedOpd, searchQuery, onlyMissingLayer, missingLayerIds]);

  // Pagination Slicing
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(readPageParam(searchParams), totalPages);
  const goToPage = (page: number) => setParams({ page: page <= 1 ? null : String(page) });
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredData.slice(startIdx, startIdx + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const startIndex = filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredData.length);

  // Overview metrics calculations
  const totalDatasetsGeoportal = cachedLayers.length;

  // Tahun aktif terbaru (Pengaturan Tahun)
  const latestYear = Math.max(...tahunAktif);

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
    <div className="flex flex-1 flex-col">

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-10 pt-9 pb-16">
        <PageHeader
          title="Verifikasi daftar data"
          description="Cocokkan setiap daftar data dengan layer Geoportal dan unsur KUGI-nya. Urutan mengikuti nomor pada sheet Daftar Data."
          actions={
            <>
              <SyncButton onSynced={fetchData} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="sm"
                      className="h-9 bg-qty px-3 text-sm text-sheet hover:bg-qty/90"
                    >
                      <Settings2 className="h-4 w-4 mr-1.5" />
                      Pengaturan
                      {usulanList.length > 0 && (
                        <span className="ml-1.5 bg-sheet px-1.5 text-xs font-semibold text-qty tabular-nums">
                          {usulanList.length}
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => setMenuDialog("tambah")} className="cursor-pointer">
                    <PlusCircle className="h-4 w-4 mr-1 text-qty" />
                    Tambah data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMenuDialog("csv")} className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1 text-qty" />
                    Unggah CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectMode(true)} className="cursor-pointer">
                    <ListChecks className="h-4 w-4 mr-1 text-qty" />
                    Pilih beberapa data
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMenuDialog("urutan")} className="cursor-pointer">
                    <ArrowUpDown className="h-4 w-4 mr-1 text-qty" />
                    Atur urutan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMenuDialog("usulan")} className="cursor-pointer">
                    <GitMerge className="h-4 w-4 mr-1 text-qty" />
                    Usulan merge
                    {usulanList.length > 0 && (
                      <span className="ml-auto text-xs font-semibold text-qty tabular-nums">{usulanList.length}</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-ink/10" />
                  <DropdownMenuItem onClick={() => setMenuDialog("laporan")} className="cursor-pointer">
                    <FileDown className="h-4 w-4 mr-1 text-qty" />
                    Unduh laporan Word
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMenuDialog("riwayat")} className="cursor-pointer">
                    <History className="h-4 w-4 mr-1 text-qty" />
                    Riwayat perubahan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setMenuDialog("tahun")} className="cursor-pointer">
                    <CalendarCog className="h-4 w-4 mr-1 text-qty" />
                    Pengaturan tahun
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <DbErrorBanner message={loadError} />

        <StatStrip
          loading={isLoading}
          items={[
            { label: `Daftar data ${latestYear}`, value: latestYearData.length, note: "Target tahun terbaru" },
            { label: `Terisi ${latestYear}`, value: latestYearFilled, note: `${latestYearFilledPercent}% sudah punya layer` },
            { label: "Ber-KUGI", value: `${latestYearKugiPercent}%`, note: `${latestYearKugiStandardized} dari ${latestYearData.length} daftar data` },
            { label: "Layer di Geoportal", value: totalDatasetsGeoportal, note: "Dari cache GeoNode" },
          ]}
        />

        {/* 2. DATA TABLE SECTION */}
        <section className="border-y-2 border-ink bg-sheet">
          {/* Table Header & Multi-Filter Controls */}
          <div className="px-4 py-4 sm:px-5 border-b border-ink flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div>
              <h2 className="font-cond text-[21px] font-bold">Daftar data</h2>
              <p className="text-sm text-ink-2 mt-0.5">Cari menurut nama data, OPD, KUGI, atau tag bidang.</p>
            </div>

            {/* Controls: Search, Filter OPD, Filter Tahun */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2" />
                <Input
                  type="text"
                  placeholder="Cari data, OPD, atau KUGI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-sheet border-ink/40 focus-visible:ring-qty/30"
                />
              </div>

              {/* Filter OPD Dropdown */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <select
                  id="filter-opd"
                  aria-label="Perangkat daerah"
                  value={selectedOpd}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    setParams({ opd: selectedValue === "all" ? null : selectedValue, page: null });
                  }}
                  className={cn(controlClass, "pr-8 cursor-pointer truncate text-left max-w-[200px]")}
                >
                  <option value="all">Semua Perangkat Daerah</option>
                  {activeGeoportalOpds.map((opd) => (
                    <option key={opd.id} value={opd.username_jigd?.toLowerCase() || opd.id}>
                      {opd.nama_opd} {opd.username_jigd ? `(@${opd.username_jigd})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tahun Dropdown */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <select
                  id="filter-tahun"
                  aria-label="Tahun"
                  value={selectedYear}
                  onChange={(e) => setParams({ tahun: e.target.value === "all" ? null : e.target.value, page: null })}
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
            </div>
          </div>

          {/* Table Summary Quick Bar */}
          <div className="px-4 sm:px-5 py-2.5 border-b border-rule flex flex-wrap items-center justify-between text-sm text-ink-2 gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
              <span className="text-ink">{filteredData.length} daftar data</span>
              <span className="inline-flex items-center gap-1.5"><Swatch filled />{totalFilled} terisi ({percentageFilled}%)</span>
              <span className="inline-flex items-center gap-1.5"><Swatch />{filteredData.length - totalFilled} belum terisi</span>
              {usulanList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMenuDialog("usulan")}
                  className="inline-flex items-center gap-1.5 text-qty hover:underline cursor-pointer"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  {usulanList.length} usulan merge menunggu
                </button>
              )}
              {missingLayerIds.size > 0 && !onlyMissingLayer && (
                <button
                  type="button"
                  onClick={() => setParams({ hilang: "1", page: null })}
                  className="inline-flex items-center gap-1.5 text-bound hover:underline cursor-pointer"
                  title="Tampilkan daftar data yang layernya sudah tidak ada di Geoportal"
                >
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {missingLayerIds.size} merujuk layer yang hilang
                </button>
              )}
            </div>

            {/* Chip filter aktif: teks boleh turun baris (tidak terpotong), klik × untuk menghapus filter */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {selectedOpd !== "all" && (
                <FilterChip
                  label="OPD"
                  value={opdList.find(o => o.id === selectedOpd || o.username_jigd?.toLowerCase() === selectedOpd.toLowerCase())?.nama_opd || "Terfilter"}
                  onRemove={() => setParams({ opd: null, page: null })}
                  className="border border-qty/60 text-ink"
                />
              )}
              {onlyMissingLayer && (
                <FilterChip
                  label="Layer"
                  value="hilang dari Geoportal"
                  onRemove={() => setParams({ hilang: null, page: null })}
                  className="border border-bound/60 text-bound"
                />
              )}
              {selectedYear !== "all" && (
                <FilterChip
                  label="Tahun"
                  value={selectedYear}
                  onRemove={() => setParams({ tahun: null, page: null })}
                  className="border border-ink/40 text-ink"
                />
              )}
            </div>
          </div>

          {/* Loading or Empty State */}
          {isLoading ? (
            <SkeletonRows rows={8} />
          ) : filteredData.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <div className="space-y-1">
                <h3 className="font-cond text-xl font-bold">
                  {dataList.length === 0 ? "Belum ada daftar data" : "Tidak ada daftar data yang cocok"}
                </h3>
                <p className="text-sm text-ink-2 max-w-md mx-auto">
                  {dataList.length === 0
                    ? "Anda dapat mengunggah file CSV daftar data, menambahkan data manual satu per satu, atau memuat data contoh untuk simulasi."
                    : "Coba ubah kata kunci pencarian, atau bersihkan filter OPD dan Tahun."}
                </p>
              </div>

              {dataList.length === 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <CsvUploadDialog opdList={opdList} defaultYear={latestYear} onSuccess={fetchData} />
                  <ManualAddDialog opdList={opdList} defaultYear={latestYear} onSuccess={fetchData} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSeedSampleData}
                    className="border-ink/30 text-ink hover:bg-ink/5"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-contour" />
                    Muat 6 Data Contoh
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* The Complete Data Table with 5 Exact Columns */
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-ink hover:bg-transparent">
                    {selectMode && (
                      <TableHead className="w-10 py-3.5 pl-4 sm:pl-5 pr-0">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua daftar data di halaman ini"
                          checked={paginatedData.length > 0 && paginatedData.every((d) => selectedIds.has(d.id))}
                          ref={(el) => {
                            if (el) {
                              const some = paginatedData.some((d) => selectedIds.has(d.id));
                              el.indeterminate = some && !paginatedData.every((d) => selectedIds.has(d.id));
                            }
                          }}
                          onChange={(e) => toggleSelected(paginatedData.map((d) => d.id), e.target.checked)}
                          className="h-4 w-4 accent-qty cursor-pointer"
                        />
                      </TableHead>
                    )}
                    {/* Column 1: Perangkat Daerah */}
                    <TableHead className="hidden lg:table-cell font-cond font-semibold text-sm py-3.5 pl-5 min-w-[250px] whitespace-normal">
                      Perangkat daerah
                    </TableHead>
                    {/* Column 2: Daftar Data Geospasial */}
                    <TableHead className="font-cond font-semibold text-sm py-3.5 pl-4 lg:pl-2 md:min-w-[250px] whitespace-normal">
                      Nama data dan layer
                    </TableHead>
                    {/* Column 3: Standar KUGI */}
                    <TableHead className="hidden md:table-cell font-cond font-semibold text-sm py-3.5 min-w-[180px] whitespace-normal">
                      KUGI
                    </TableHead>
                    {/* Column 4: Status */}
                    <TableHead className="hidden md:table-cell font-cond font-semibold text-sm py-3.5 min-w-[130px]">
                      Status
                    </TableHead>
                    {/* Column 5: Aksi */}
                    <TableHead className="font-cond font-semibold text-sm py-3.5 pr-4 sm:pr-5 text-right md:min-w-[100px]">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="animate-reveal">
                  {paginatedData.map((item) => {
                    const primaryLayer = item.layer_utama_uuid ? layerMap.get(item.layer_utama_uuid) : null;
                    const datasetUrl = primaryLayer
                      ? `https://jigd.kaltimprov.go.id/catalogue/#/dataset/${primaryLayer.id_dataset}`
                      : null;
                    const pelengkapLayers = (item.layer_pelengkap_uuids || [])
                      .map((uuid) => layerMap.get(uuid))
                      .filter(Boolean) as CacheLayerGeoportal[];
                    const missingUtama = Boolean(item.layer_utama_uuid) && !primaryLayer && layerMap.size > 0;
                    const missingPelengkap =
                      layerMap.size > 0 ? (item.layer_pelengkap_uuids || []).length - pelengkapLayers.length : 0;

                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          "border-b border-rule hover:bg-qty/5 transition-colors",
                          selectMode && selectedIds.has(item.id) && "bg-qty/10"
                        )}
                      >
                        {selectMode && (
                          <TableCell className="w-10 py-3.5 pl-4 sm:pl-5 pr-0 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Pilih ${item.nama_data}`}
                              checked={selectedIds.has(item.id)}
                              onChange={(e) => toggleSelected([item.id], e.target.checked)}
                              className="mt-0.5 h-4 w-4 accent-qty cursor-pointer"
                            />
                          </TableCell>
                        )}
                        {/* 1. Perangkat Daerah: whitespace-normal break-words min-w-[250px] */}
                        <TableCell className="hidden lg:table-cell py-3.5 pl-5 align-top whitespace-normal break-words min-w-[250px]">
                          <div className="text-sm text-ink">
                            {item.master_opd?.nama_opd || "OPD belum terhubung"}
                          </div>
                          <div className="mt-0.5 text-[13px] text-ink-2 tabular-nums">
                            {(item.tahun_berlaku || []).join(", ")}
                          </div>
                        </TableCell>

                        {/* 2. Daftar Data Geospasial: whitespace-normal break-words min-w-[250px] */}
                        <TableCell className="py-3.5 pl-4 lg:pl-2 align-top whitespace-normal break-words md:min-w-[250px]">
                          {/* OPD & tahun untuk layar < lg (kolom Perangkat Daerah disembunyikan) */}
                          <div className="lg:hidden mb-1 text-[13px] text-ink-2">
                            {item.master_opd?.nama_opd || "OPD belum terhubung"}
                            {(item.tahun_berlaku || []).length > 0 && `, ${(item.tahun_berlaku || []).join(", ")}`}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink leading-snug">
                              {item.nama_data}
                            </span>
                            {item.tag_bidang && (
                              <span className="border border-ink/30 px-1.5 text-xs text-ink-2">{item.tag_bidang}</span>
                            )}
                          </div>
                          {primaryLayer ? (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[13px] text-ink-2 break-all">
                                {primaryLayer.name} ({primaryLayer.geometry_type || "Layer"})
                              </span>
                              <a
                                href={datasetUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-qty hover:underline"
                                title="Buka layer di Geoportal"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : missingUtama ? (
                            <div className="mt-1 flex items-start gap-1.5 text-[13px] text-bound">
                              <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>Layer utama sudah tidak ada di Geoportal. Pilih penggantinya lewat Verifikasi.</span>
                            </div>
                          ) : (
                            <div className="text-[13px] text-ink-2 italic mt-0.5">
                              Belum ada layer terpaut
                            </div>
                          )}
                          {missingPelengkap > 0 && (
                            <div className="mt-1 flex items-start gap-1.5 text-[13px] text-bound">
                              <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{missingPelengkap} layer pelengkap sudah tidak ada di Geoportal.</span>
                            </div>
                          )}

                          {/* Supplementary Layers (Layer Pelengkap) collapsible */}
                          {pelengkapLayers.length > 0 && (
                            <details className="group mt-2 text-xs">
                              <summary className="cursor-pointer text-[13px] text-link hover:underline select-none list-none flex items-center gap-1">
                                <span className="text-[9px] transition-transform duration-150 group-open:rotate-90 text-ink-2">▶</span>
                                <span>{pelengkapLayers.length} layer pelengkap</span>
                              </summary>
                              <ul className="mt-1.5 pl-3 border-l-2 border-rule space-y-1">
                                {pelengkapLayers.map((pLayer) => (
                                  <li key={pLayer.uuid} className="text-[13px] text-ink-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-ink">{pLayer.title}</span>
                                      <span className="text-ink-2">({pLayer.name})</span>
                                      {pLayer.id_dataset && (
                                        <a
                                          href={`https://jigd.kaltimprov.go.id/catalogue/#/dataset/${pLayer.id_dataset}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-qty hover:underline inline-flex items-center"
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

                          {/* KUGI & status untuk layar < md (kolomnya disembunyikan) */}
                          <div className="md:hidden mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="text-[13px]"><StatusLabel filled={item.status_keterisian} /></span>
                            <span className="text-[13px] text-ink-2">
                              KUGI:{" "}
                              {item.master_kugi?.nama_unsur || item.kugi_nama_unsur ? (
                                <span className="text-ink">
                                  {item.master_kugi?.nama_unsur || item.kugi_nama_unsur}
                                  {item.master_kugi?.kode_unsur && (
                                    <span className="font-normal"> ({item.master_kugi.kode_unsur})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="italic">belum dipetakan</span>
                              )}
                            </span>
                          </div>
                        </TableCell>

                        {/* 3. Standar KUGI: whitespace-normal break-words */}
                        <TableCell className="hidden md:table-cell py-3.5 align-top text-sm text-ink whitespace-normal break-words min-w-[180px]">
                          {item.master_kugi?.nama_unsur || item.kugi_nama_unsur ? (
                            <div>
                              <div className="break-all">{item.master_kugi?.nama_unsur || item.kugi_nama_unsur}</div>
                              <div className="mt-0.5 text-[13px] text-ink-2">
                                {item.master_kugi?.kode_unsur || "Kode belum ditentukan"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[13px] text-ink-2 italic">Belum dipetakan</span>
                          )}
                        </TableCell>

                        {/* 4. Status (Red / Green Badge) */}
                        <TableCell className="hidden md:table-cell py-3.5 align-top text-sm">
                          <StatusLabel filled={item.status_keterisian} />
                        </TableCell>

                        {/* 5. Aksi: Action Menu (DropdownMenu with "Verifikasi Data" and "Merge dengan Data Lain") */}
                        <TableCell className="py-3.5 pr-4 sm:pr-5 align-top text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Aksi untuk ${item.nama_data}`}
                                  className="h-8 px-2.5 text-sm border-ink/40 bg-transparent text-ink hover:bg-ink/5"
                                >
                                  <span className="hidden sm:inline">Aksi</span>
                                  <MoreHorizontal className="h-3.5 w-3.5 sm:ml-1 text-ink-2" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-52">
                              {/* Option 1: Verifikasi Data */}
                              <DropdownMenuItem
                                onClick={() => setEditingRecord(item)}
                                className="cursor-pointer text-sm"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 mr-2 text-qty" />
                                <span>Verifikasi Data</span>
                              </DropdownMenuItem>

                              {/* Option 2: Merge dengan Data Lain */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setMergeTargetId(null);
                                  setMergingRecord(item);
                                }}
                                className="cursor-pointer text-sm"
                              >
                                <GitMerge className="h-3.5 w-3.5 mr-2 text-qty" />
                                <span>Merge dengan Data Lain</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-ink/5" />

                              {/* Delete Option */}
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleDeleteRecord(item.id, item.nama_data)}
                                className="cursor-pointer text-sm"
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

          {/* Bilah aksi mode pilih: menempel di bawah layar selama tabel terlihat */}
          {selectMode && (
            <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-ink bg-sheet px-4 py-3 text-sm sm:px-5 animate-reveal">
              <span className="font-semibold text-ink tabular-nums">{selectedIds.size} dipilih</span>
              {filteredData.some((d) => !selectedIds.has(d.id)) && (
                <button
                  type="button"
                  onClick={() => toggleSelected(filteredData.map((d) => d.id), true)}
                  className="text-link hover:underline cursor-pointer"
                >
                  Pilih semua {filteredData.length} hasil filter
                </button>
              )}
              {selectedIds.size > 0 && (
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-ink-2 hover:text-ink hover:underline cursor-pointer">
                  Kosongkan pilihan
                </button>
              )}
              <span className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={() => setMenuDialog("bulk")}
                disabled={selectedIds.size === 0}
                className="h-9 bg-qty px-3 text-sheet hover:bg-qty/90"
              >
                Ubah data terpilih
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={exitSelectMode}
                className="h-9 border-ink bg-transparent px-3 text-ink hover:bg-ink/5"
              >
                Selesai
              </Button>
            </div>
          )}

          {/* Pagination Controls & Rows Per Page Selector */}
          {!isLoading && filteredData.length > 0 && (
            <div className="px-4 py-3 sm:px-5 border-t border-ink flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-2">
              {/* Row count range */}
              <div className="tabular-nums">
                Baris {startIndex}–{endIndex} dari {filteredData.length} daftar data
              </div>

              {/* Pagination controls & Page Size */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-1.5">
                  <span>Tampilkan</span>
                  <select
                    aria-label="Baris per halaman"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      goToPage(1);
                    }}
                    className={cn(controlClass, "h-8 px-2 cursor-pointer")}
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
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 px-2.5 text-sm border-ink/40 bg-transparent disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Sebelumnya
                  </Button>

                  <span className="text-ink px-1 tabular-nums">
                    {currentPage} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 px-2.5 text-sm border-ink/40 bg-transparent disabled:opacity-40"
                  >
                    Selanjutnya
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="px-4 py-3 sm:px-5 border-t border-rule text-[13px] text-ink-2 flex flex-col sm:flex-row items-center justify-between gap-1">
            <span>Layer dicocokkan dengan cache Geoportal JIGD. Perbarui lewat Sinkronisasi JIGD.</span>
            {!isLoading && (
              <span className={loadError ? "text-bound" : undefined}>
                Database {loadError ? "tidak terhubung" : "terhubung"}
              </span>
            )}
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
        tahunAktif={tahunAktif}
        availableTags={availableTags}
        allRecords={dataList}
        onSuccess={fetchData}
      />

      {/* Merge Data Dialog Modal */}
      <ManualAddDialog opdList={opdList} defaultYear={latestYear} onSuccess={fetchData} {...menuDialogProps("tambah")} />
      <CsvUploadDialog opdList={opdList} defaultYear={latestYear} onSuccess={fetchData} {...menuDialogProps("csv")} />
      <OrderDialog dataList={dataList} opdList={opdList} onSuccess={fetchData} {...menuDialogProps("urutan")} />
      <MergeSuggestionsDialog
        usulan={usulanList}
        dataList={dataList}
        layerMap={layerMap}
        onReview={(data, target) => {
          setMenuDialog(null);
          setMergeTargetId(target.id);
          setMergingRecord(data);
        }}
        onChanged={fetchData}
        {...menuDialogProps("usulan")}
      />
      <ReportDownloadDialog years={availableYears} defaultYear={latestYear} dataList={dataList} {...menuDialogProps("laporan")} />
      <HistoryDialog opdList={opdList} kugiList={kugiList} layerMap={layerMap} {...menuDialogProps("riwayat")} />
      <YearSettingsDialog years={tahunAktif} onSuccess={fetchData} {...menuDialogProps("tahun")} />
      <BulkEditDialog
        records={dataList.filter((d) => selectedIds.has(d.id))}
        cachedLayers={cachedLayers}
        kugiList={kugiList}
        availableTags={availableTags}
        yearOptions={availableYears}
        onSuccess={fetchData}
        {...menuDialogProps("bulk")}
      />

      <MergeDataDialog
        sourceRecord={mergingRecord}
        initialTargetId={mergeTargetId}
        isOpen={Boolean(mergingRecord)}
        onClose={() => {
          setMergingRecord(null);
          // Kembali ke daftar usulan bila merge dibuka dari sana
          if (mergeTargetId) {
            setMergeTargetId(null);
            setMenuDialog("usulan");
          }
        }}
        allRecords={dataList}
        allCachedLayers={cachedLayers}
        onSuccess={fetchData}
      />

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-qty" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
