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
  Database,
  Search,
  Building2,
  ExternalLink,
  Layers,
  Globe2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Hash,
  Table2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CacheLayerGeoportal, MasterOpd } from "@/types/database";

function DatasetsContent() {
  const searchParams = useSearchParams();
  const opdParam = searchParams.get("opd");

  const [layers, setLayers] = useState<CacheLayerGeoportal[]>([]);
  const [opdList, setOpdList] = useState<MasterOpd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpdUsername, setSelectedOpdUsername] = useState("all");
  const [selectedGeometry, setSelectedGeometry] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [opdRes, layersRes] = await Promise.all([
        supabase.from("master_opd").select("*").order("nama_opd", { ascending: true }),
        supabase.from("cache_layer_geoportal").select("*").order("date_published", { ascending: false }),
      ]);

      if (opdRes.data) setOpdList(opdRes.data);
      if (layersRes.data) setLayers(layersRes.data);
    } catch (err) {
      console.error("Error fetching datasets:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync ?opd= query parameter
  useEffect(() => {
    if (opdParam && (opdList.length > 0 || layers.length > 0)) {
      const matchInOpd = opdList.find(
        (o) =>
          o.username_jigd?.toLowerCase() === opdParam.toLowerCase() ||
          o.id === opdParam
      );
      if (matchInOpd && matchInOpd.username_jigd) {
        setSelectedOpdUsername(matchInOpd.username_jigd.toLowerCase());
      } else {
        // Fallback check direct username match in layers
        const directMatch = layers.find(
          (l) => l.owner_username?.toLowerCase() === opdParam.toLowerCase()
        );
        if (directMatch) {
          setSelectedOpdUsername(directMatch.owner_username.toLowerCase());
        }
      }
    }
  }, [opdParam, opdList, layers]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedOpdUsername, selectedGeometry, pageSize]);

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
  const paginatedLayers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLayers.slice(start, start + pageSize);
  }, [filteredLayers, currentPage, pageSize]);

  const startIndex = filteredLayers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, filteredLayers.length);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans transition-colors">
      <Navbar currentPage="datasets" />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
              JIGD Kaltim
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Katalog Dataset Layer Geoportal
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Eksplorasi seluruh layer peta, tipe geometri, sistem koordinat, dan produsen data terpublikasi di GeoNode.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-xs font-medium text-slate-600 dark:text-slate-400">
              Total Dataset Aktif: <strong className="text-blue-600 dark:text-blue-400 font-bold">{layers.length}</strong>
            </div>
          </div>
        </div>

        {/* Catalog Table Section */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Controls Bar */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Daftar Layer Geoportal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pencarian dan penapisan metadata layer spasial tersinkronisasi
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Cari judul, layer, OPD, SRID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
                />
              </div>

              {/* Filter OPD */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  id="filter-opd-datasets"
                  value={selectedOpdUsername}
                  onChange={(e) => setSelectedOpdUsername(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer truncate text-left max-w-[200px]"
                >
                  <option value="all">Semua Perangkat Daerah</option>
                  {activeGeoportalOpds.map((opd) => (
                    <option key={opd.id} value={opd.username_jigd || ""}>
                      {opd.nama_opd} {opd.username_jigd ? `(@${opd.username_jigd})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Tipe Geometri */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <select
                  id="filter-geometry"
                  value={selectedGeometry}
                  onChange={(e) => setSelectedGeometry(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
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
          <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-3">
              <span>
                Menampilkan <strong className="text-slate-900 dark:text-slate-100">{filteredLayers.length}</strong> layer
                {selectedOpdUsername !== "all" && (
                  <span className="ml-1 text-blue-600 dark:text-blue-400 font-semibold">
                    (Filter OPD: @{selectedOpdUsername})
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Baris per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Table Content */}
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Memuat katalog dataset layer...</p>
            </div>
          ) : paginatedLayers.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
              <Database className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Tidak ada dataset yang cocok
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Coba sesuaikan kata kunci pencarian atau bersihkan filter OPD untuk melihat seluruh layer.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedOpdUsername("all");
                    setSelectedGeometry("all");
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
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <TableHead className="w-[50px] text-center font-bold">#</TableHead>
                    <TableHead className="min-w-[280px] font-bold">Title / Nama Layer</TableHead>
                    <TableHead className="min-w-[200px] font-bold">Workspace / OPD</TableHead>
                    <TableHead className="min-w-[140px] font-bold">Tipe Data</TableHead>
                    <TableHead className="min-w-[120px] font-bold">SRID</TableHead>
                    <TableHead className="w-[100px] text-center font-bold">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLayers.map((layer, idx) => (
                    <TableRow
                      key={layer.uuid || layer.id_dataset || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 transition-colors"
                    >
                      {/* Row Index */}
                      <TableCell className="text-center text-xs font-mono text-slate-400 dark:text-slate-500">
                        {startIndex + idx}
                      </TableCell>

                      {/* Title & Name */}
                      <TableCell className="py-3">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug">
                          {layer.title || "Layer Tanpa Judul"}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {layer.name}
                          </code>
                          {layer.date_published && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(layer.date_published).toLocaleDateString("id-ID", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Workspace / OPD */}
                      <TableCell>
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {layer.owner_name || "-"}
                        </div>
                        {layer.owner_username && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] mt-1 font-mono font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            @{layer.owner_username}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Geometry Type */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs font-medium border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                        >
                          <Layers className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
                          {layer.geometry_type || "Tidak Terdeteksi"}
                        </Badge>
                        {layer.attribute_count !== undefined && layer.attribute_count !== null && (
                          <div className="text-[11px] text-slate-400 mt-1">
                            {layer.attribute_count} atribut
                          </div>
                        )}
                      </TableCell>

                      {/* SRID */}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="font-mono text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50"
                        >
                          <Globe2 className="h-3 w-3 mr-1 text-blue-600 dark:text-blue-400" />
                          {layer.srid || "EPSG:4326"}
                        </Badge>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-center">
                        {layer.dataset_url ? (
                          <a
                            href={layer.dataset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Buka layer di Geoportal JIGD"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
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
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Menampilkan baris <strong>{startIndex}</strong> - <strong>{endIndex}</strong> dari total{" "}
                <strong>{filteredLayers.length}</strong> layer
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Sebelumnya
                </Button>

                <div className="px-2 font-medium text-slate-700 dark:text-slate-300">
                  Halaman {currentPage} dari {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2.5 text-xs border-slate-200 dark:border-slate-800"
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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <DatasetsContent />
    </Suspense>
  );
}
