"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DbErrorBanner } from "@/components/db-error-banner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { PageHeader, controlClass } from "@/components/lembar-peta";
import { cn } from "@/lib/utils";
import { useQueryParams, useDebouncedQueryText, readPageParam } from "@/lib/use-query-params";

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
  Database,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { supabase, fetchAllRows, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";
import { CacheLayerGeoportal, MasterOpd } from "@/types/database";

/** Ambil daftar OPD dan layer dari Supabase secara paralel (tidak menyentuh state React). */
function loadDatasetsData() {
  return Promise.all([
    supabase.from("master_opd").select("*").order("nama_opd", { ascending: true }),
    fetchAllRows<CacheLayerGeoportal>((from, to) =>
      supabase
        .from("cache_layer_geoportal")
        .select("*")
        .order("date_published", { ascending: false })
        .order("id_dataset", { ascending: true })
        .range(from, to)
    ),
  ]);
}

function DatasetsContent() {
  const { searchParams, setParams } = useQueryParams();
  const opdParam = searchParams.get("opd");

  const [layers, setLayers] = useState<CacheLayerGeoportal[]>([]);
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  // Filter disimpan di URL: ?opd=&geom=&q=&page=
  const [searchQuery, setSearchQuery] = useDebouncedQueryText("q", searchParams.get("q") ?? "", setParams);
  const selectedGeometry = searchParams.get("geom") ?? "all";

  // Pagination
  const [pageSize, setPageSize] = useState(10);

  // Fetch data
  const fetchData = useCallback(
    () =>
      loadDatasetsData()
        .then(([opdRes, layersRes]) => {
          if (opdRes.data) setOpdList(opdRes.data);
          if (!layersRes.error) setLayers(layersRes.data);
          setLoadError(opdRes.error || layersRes.error ? DB_UNREACHABLE_MESSAGE : null);
        })
        .catch((err) => {
          console.error("Error fetching datasets:", err);
          setLoadError(DB_UNREACHABLE_MESSAGE);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter OPD mengikuti parameter URL ?opd= (username_jigd OPD, id OPD, atau owner layer)
  const selectedOpdUsername = useMemo(() => {
    if (!opdParam) return "all";
    const param = opdParam.toLowerCase();
    const matchInOpd = opdList.find(
      (o) => o.username_jigd?.toLowerCase() === param || o.id === opdParam
    );
    if (matchInOpd?.username_jigd) return matchInOpd.username_jigd.toLowerCase();
    const directMatch = layers.find((l) => l.owner_username?.toLowerCase() === param);
    return directMatch ? directMatch.owner_username.toLowerCase() : "all";
  }, [opdParam, opdList, layers]);

  // Unique geometry types from cache
  const availableGeometries = useMemo(() => {
    const set = new Set<string>();
    layers.forEach((l) => {
      if (l.geometry_type) set.add(l.geometry_type);
    });
    return Array.from(set).sort();
  }, [layers]);

  // Only OPDs that have at least one layer in cache_layer_geoportal
  const activeGeoportalOpds = useMemo(() => {
    const uploadedOwners = new Set(
      layers
        .map((l) => l.owner_username?.toLowerCase().trim())
        .filter(Boolean)
    );

    return opdList.filter(
      (opd) =>
        opd.username_jigd &&
        uploadedOwners.has(opd.username_jigd.toLowerCase().trim())
    );
  }, [opdList, layers]);

  // Filtered layers
  const filteredLayers = useMemo(() => {
    return layers.filter((item) => {
      // 1. OPD match
      const matchOpd =
        selectedOpdUsername === "all" ||
        item.owner_username?.toLowerCase() === selectedOpdUsername.toLowerCase();

      // 2. Geometry match
      const matchGeo =
        selectedGeometry === "all" ||
        item.geometry_type?.toLowerCase() === selectedGeometry.toLowerCase();

      // 3. Search query match
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.owner_name?.toLowerCase().includes(q) ||
        item.owner_username?.toLowerCase().includes(q) ||
        item.srid?.toLowerCase().includes(q) ||
        item.geometry_type?.toLowerCase().includes(q);

      return matchOpd && matchGeo && matchSearch;
    });
  }, [layers, selectedOpdUsername, selectedGeometry, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLayers.length / pageSize));
  const currentPage = Math.min(readPageParam(searchParams), totalPages);
  const goToPage = (page: number) => setParams({ page: page <= 1 ? null : String(page) });
  const paginatedLayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLayers.slice(start, start + pageSize);
  }, [filteredLayers, currentPage, pageSize]);

  const startIndex = filteredLayers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredLayers.length);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentPage="datasets" />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-10 pt-9 pb-16">
        <DbErrorBanner message={loadError} />
        <PageHeader
          title="Katalog layer Geoportal"
          description={
            <>
              {isLoading ? "Memuat layer…" : `${layers.length} layer`} di GeoNode JIGD beserta pemilik, tipe geometri, dan sistem koordinatnya.
            </>
          }
        />

        {/* Catalog Table Section */}
        <section className="border-y-2 border-ink bg-sheet">
          {/* Controls Bar */}
          <div className="px-4 py-4 sm:px-5 border-b border-ink flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div>
              <h2 className="font-cond text-[21px] font-bold">Daftar layer</h2>
              <p className="text-sm text-ink-2 mt-0.5">Cari menurut judul, nama layer, OPD, atau SRID.</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-2" />
                <Input
                  type="text"
                  placeholder="Cari judul, layer, OPD, SRID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm bg-sheet border-ink/40 focus-visible:ring-qty/30"
                />
              </div>

              {/* Filter OPD */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <select
                  id="filter-opd-datasets"
                  aria-label="Perangkat daerah"
                  value={selectedOpdUsername}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    setParams({ opd: selectedValue === "all" ? null : selectedValue, page: null });
                  }}
                  className={cn(controlClass, "pr-8 cursor-pointer truncate text-left max-w-[200px]")}
                >
                  <option value="all">Semua Perangkat Daerah</option>
                  {activeGeoportalOpds.map((opd) => (
                    <option key={opd.id} value={opd.username_jigd?.toLowerCase() || ""}>
                      {opd.nama_opd} {opd.username_jigd ? `(@${opd.username_jigd})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tipe Geometri */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <select
                  id="filter-geometry"
                  aria-label="Tipe geometri"
                  value={selectedGeometry}
                  onChange={(e) => setParams({ geom: e.target.value === "all" ? null : e.target.value, page: null })}
                  className={cn(controlClass, "pr-8 cursor-pointer")}
                >
                  <option value="all">Semua Geometri</option>
                  {availableGeometries.map((geo) => (
                    <option key={geo} value={geo}>
                      {geo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Stat Bar */}
          <div className="px-4 sm:px-5 py-2.5 border-b border-rule flex flex-wrap items-center justify-between text-sm text-ink-2 gap-2">
            <div className="flex items-center gap-3">
              <span>
                {filteredLayers.length} layer
                {selectedOpdUsername !== "all" && <> milik @{selectedOpdUsername}</>}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-2">Baris per halaman</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  goToPage(1);
                }}
                aria-label="Baris per halaman"
                className={cn(controlClass, "h-8 px-2")}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <SkeletonRows rows={10} />
          ) : paginatedLayers.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
              <Database className="h-10 w-10 text-ink-2/60" />
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-ink mb-1">
                  Tidak ada dataset yang cocok
                </h4>
                <p className="text-xs text-ink-2 mb-4">
                  Coba sesuaikan kata kunci pencarian atau bersihkan filter OPD untuk melihat seluruh layer.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setParams({ q: null, opd: null, geom: null, page: null });
                  }}
                  className="text-xs"
                >
                  Reset Filter
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-ink hover:bg-transparent">
                    <TableHead className="hidden sm:table-cell w-[50px] text-center font-cond font-semibold">No.</TableHead>
                    <TableHead className="md:min-w-[280px] font-cond font-semibold">Judul dan nama layer</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[200px] font-cond font-semibold">Pemilik (OPD)</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[120px] font-cond font-semibold">Geometri</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[120px] font-cond font-semibold">SRID</TableHead>
                    <TableHead className="w-[60px] md:w-[80px] text-center font-cond font-semibold">Buka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLayers.map((layer, idx) => (
                    <TableRow
                      key={layer.uuid || layer.id_dataset || idx}
                      className="border-b border-rule hover:bg-qty/5 transition-colors"
                    >
                      {/* Row Index */}
                      <TableCell className="hidden sm:table-cell text-center text-sm text-contour tabular-nums">
                        {startIndex + idx}
                      </TableCell>

                      {/* Title & Name */}
                      <TableCell className="py-3 whitespace-normal">
                        <div className="text-sm text-ink leading-snug">
                          {layer.title || "Layer Tanpa Judul"}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <code className="text-[13px] text-ink-2 break-all">
                            {layer.name}
                          </code>
                          {layer.date_published && (
                            <span className="text-[13px] text-ink-2">
                              {new Date(layer.date_published).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        {/* Ringkasan untuk layar kecil (kolom lain disembunyikan) */}
                        <div className="lg:hidden mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                          {layer.owner_username && (
                            <span className="md:hidden">@{layer.owner_username}</span>
                          )}
                          <span>{layer.geometry_type || "Tidak Terdeteksi"}</span>
                          <span>{layer.srid || "-"}</span>
                        </div>
                      </TableCell>

                      {/* Workspace / OPD */}
                      <TableCell className="hidden md:table-cell whitespace-normal">
                        <div className="text-sm text-ink">{layer.owner_name || "-"}</div>
                        {layer.owner_username && (
                          <div className="mt-0.5 text-[13px] text-ink-2">@{layer.owner_username}</div>
                        )}
                      </TableCell>

                      {/* Geometry Type */}
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">{layer.geometry_type || "Tidak terdeteksi"}</div>
                        {layer.attribute_count !== undefined && layer.attribute_count !== null && (
                          <div className="text-[13px] text-ink-2 mt-0.5">
                            {layer.attribute_count} atribut
                          </div>
                        )}
                      </TableCell>

                      {/* SRID */}
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm tabular-nums">{layer.srid || "-"}</span>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-center align-top md:align-middle">
                        {layer.dataset_url ? (
                          <a
                            href={layer.dataset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 border border-ink/40 text-qty hover:bg-qty/10 transition-colors"
                            title="Buka layer di Geoportal JIGD"
                            aria-label={`Buka ${layer.title || layer.name} di Geoportal JIGD`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-ink-2">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Footer */}
          {!isLoading && filteredLayers.length > 0 && (
            <div className="px-4 py-3 sm:px-5 border-t border-ink flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-2">
              <div className="tabular-nums">
                Baris {startIndex}–{endIndex} dari {filteredLayers.length} layer
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-sm border-ink/40 bg-transparent"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Sebelumnya
                </Button>

                <div className="px-2 text-ink tabular-nums">
                  Halaman {currentPage} dari {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-sm border-ink/40 bg-transparent"
                >
                  Selanjutnya
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function DatasetsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-paper">
          <Loader2 className="h-8 w-8 animate-spin text-qty" />
        </div>
      }
    >
      <DatasetsContent />
    </Suspense>
  );
}
