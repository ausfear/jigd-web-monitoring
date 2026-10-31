"use client";

import React, { useState, useMemo } from "react";
import {
  FileCheck2,
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  Calendar,
  ExternalLink,
  Tag,
  X,
  AlertCircle,
  Check,
  ChevronsUpDown,
  Plus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DaftarData, CacheLayerGeoportal, MasterKugi } from "@/types/database";
import { supabase } from "@/lib/supabase";

interface VerificationEditDialogProps {
  record: DaftarData | null;
  isOpen: boolean;
  onClose: () => void;
  allCachedLayers: CacheLayerGeoportal[];
  allKugi: MasterKugi[];
  /** Tahun aktif dari Pengaturan Tahun (pilihan tombol Tahun Berlaku). */
  tahunAktif: number[];
  availableTags?: string[];
  onSuccess: () => void;
}

export function VerificationEditDialog({
  record,
  isOpen,
  onClose,
  allCachedLayers,
  allKugi,
  tahunAktif,
  availableTags = [],
  onSuccess,
}: VerificationEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [namaData, setNamaData] = useState("");
  const [tagBidang, setTagBidang] = useState<string>("");
  const [openTagBidang, setOpenTagBidang] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [years, setYears] = useState<number[]>([]);

  // Cascading KUGI states
  const [selectedNamaUnsur, setSelectedNamaUnsur] = useState<string>("");
  const [selectedKugiId, setSelectedKugiId] = useState<string | null>(null);
  const [openNamaUnsur, setOpenNamaUnsur] = useState(false);

  // Layer states
  const [layerUtamaUuid, setLayerUtamaUuid] = useState<string | null>(null);
  const [layerPelengkapUuids, setLayerPelengkapUuids] = useState<string[]>([]);
  const [openLayerUtama, setOpenLayerUtama] = useState(false);
  const [openLayerPelengkap, setOpenLayerPelengkap] = useState(false);

  // STRICT REQUIREMENT: Status Keterisian is a read-only derived state:
  // If Layer Utama has a selected value, status is "Terisi" (true).
  // If Layer Utama is cleared/empty, status is "Belum Terisi" (false).
  const statusKeterisian = Boolean(layerUtamaUuid);

  // Synchronize state when target record opens (disesuaikan saat render, bukan di useEffect)
  const [prevRecord, setPrevRecord] = useState<DaftarData | null>(null);
  if (record !== prevRecord) {
    setPrevRecord(record);
    if (record) {
      setNamaData(record.nama_data || "");
      setTagBidang(record.tag_bidang || "");
      setTagSearch("");
      setOpenTagBidang(false);
      setYears(record.tahun_berlaku?.length ? record.tahun_berlaku : [Math.max(...tahunAktif)]);
      setSelectedKugiId(record.kugi_id || null);

      if (record.kugi_id) {
        const kugiObj = allKugi.find((k) => k.id === record.kugi_id);
        setSelectedNamaUnsur(kugiObj?.nama_unsur || record.kugi_nama_unsur || "");
      } else if (record.kugi_nama_unsur) {
        setSelectedNamaUnsur(record.kugi_nama_unsur);
      } else {
        setSelectedNamaUnsur("");
      }

      setLayerUtamaUuid(record.layer_utama_uuid || null);
      setLayerPelengkapUuids(record.layer_pelengkap_uuids || []);
      setErrorMessage(null);
      setOpenNamaUnsur(false);
      setOpenLayerUtama(false);
      setOpenLayerPelengkap(false);
    }
  }

  // Pilihan tahun: tahun aktif, ditambah tahun lama yang masih tercatat pada data ini
  const yearOptions = useMemo(
    () => Array.from(new Set([...tahunAktif, ...(record?.tahun_berlaku || [])])).sort((a, b) => a - b),
    [tahunAktif, record]
  );

  // OPD username_jigd for strict filtering
  const opdUsername = record?.master_opd?.username_jigd;

  // STRICT REQUIREMENT: Only display layers from cache_layer_geoportal where
  // owner_username matches the username_jigd of this specific row's OPD!
  // CRITICAL: Render ALL available layers without slicing so the user can scroll naturally.
  const opdStrictLayers = useMemo(() => {
    if (!opdUsername) return [];
    const target = opdUsername.trim().toLowerCase();
    return allCachedLayers.filter(
      (layer) => (layer.owner_username || "").trim().toLowerCase() === target
    );
  }, [allCachedLayers, opdUsername]);

  // Selected Layer Utama object
  const selectedLayerUtama = useMemo(() => {
    if (!layerUtamaUuid) return null;
    return opdStrictLayers.find((l) => l.uuid === layerUtamaUuid) || null;
  }, [layerUtamaUuid, opdStrictLayers]);

  // Available layers for Layer Pelengkap (excluding Layer Utama)
  const availablePelengkapLayers = useMemo(() => {
    return opdStrictLayers.filter((l) => l.uuid !== layerUtamaUuid);
  }, [opdStrictLayers, layerUtamaUuid]);

  // Step 1: Unique Nama Unsur strings extracted from master_kugi
  const uniqueNamaUnsur = useMemo(() => {
    const set = new Set<string>();
    allKugi.forEach((k) => {
      if (k.nama_unsur && k.nama_unsur.trim()) {
        set.add(k.nama_unsur.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allKugi]);

  // Step 2: Specific KUGI items (Alias and Kode Unsur) belonging to selected nama_unsur
  const availableKodeUnsurList = useMemo(() => {
    if (!selectedNamaUnsur) return [];
    return allKugi.filter((k) => (k.nama_unsur || "").trim() === selectedNamaUnsur.trim());
  }, [allKugi, selectedNamaUnsur]);

  // Currently selected KUGI object
  const selectedKugi = useMemo(() => {
    if (!selectedKugiId) return null;
    return allKugi.find((k) => k.id === selectedKugiId) || null;
  }, [selectedKugiId, allKugi]);

  // Handle Step 1 selection (Nama Unsur)
  const handleSelectNamaUnsur = (nama: string) => {
    setSelectedNamaUnsur(nama);
    const matches = allKugi.filter((k) => (k.nama_unsur || "").trim() === nama.trim());
    if (matches.length === 1) {
      setSelectedKugiId(matches[0].id);
    } else {
      setSelectedKugiId(null);
    }
  };

  // Reset KUGI
  const handleResetKugi = () => {
    setSelectedNamaUnsur("");
    setSelectedKugiId(null);
  };

  // Handle Layer Utama change
  const handleLayerUtamaChange = (uuid: string) => {
    const val = uuid || null;
    setLayerUtamaUuid(val);
    if (val) {
      // Remove from supplementary if selected as primary
      setLayerPelengkapUuids((prev) => prev.filter((id) => id !== val));
    }
  };

  // Toggle Layer Pelengkap selection
  const togglePelengkapLayer = (uuid: string) => {
    setLayerPelengkapUuids((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]
    );
  };

  // Remove individual Layer Pelengkap
  const removePelengkapLayer = (uuid: string) => {
    setLayerPelengkapUuids((prev) => prev.filter((id) => id !== uuid));
  };

  // Year management: pilihan mengikuti Pengaturan Tahun
  const toggleYear = (y: number) => {
    setYears((prev) =>
      prev.includes(y) ? prev.filter((item) => item !== y) : [...prev, y].sort((a, b) => a - b)
    );
  };

  // Save changes to Supabase
  const handleSave = async () => {
    if (!record) return;
    if (!namaData.trim()) {
      setErrorMessage("Nama Data Geospasial tidak boleh kosong.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      // Partial KUGI saving:
      // If Step 2 (Kode Unsur) is blank, save text from Step 1 into kugi_nama_unsur and set kugi_id to null.
      // If Step 2 is filled, save both.
      const kugiNamaUnsurToSave = selectedNamaUnsur.trim() ? selectedNamaUnsur.trim() : null;
      const kugiIdToSave = selectedKugiId || null;

      const { error } = await supabase
        .from("daftar_data")
        .update({
          nama_data: namaData.trim(),
          tag_bidang: tagBidang.trim() || null,
          kugi_id: kugiIdToSave,
          kugi_nama_unsur: kugiNamaUnsurToSave,
          tahun_berlaku: years,
          layer_utama_uuid: layerUtamaUuid,
          layer_pelengkap_uuids: layerPelengkapUuids,
          status_keterisian: statusKeterisian,
        })
        .eq("id", record.id);

      if (error) throw error;

      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error saving verification edit:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>{record.master_opd?.nama_opd || "Perangkat Daerah"}</span>
            {opdUsername ? (
              <Badge variant="outline" className="border-border bg-blue-50 text-blue-700 dark:border-slate-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] py-0 font-mono">
                @{opdUsername}
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px] py-0">
                Belum ada username_jigd
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Verifikasi &amp; Integrasi Data Geospasial
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Tetapkan standar KUGI cascading dan hubungkan layer Geoportal milik OPD ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Status Keterisian (Strict Read-Only Derived State: Layer Utama Selected => Terisi, else Belum Terisi) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-border dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Status Keterisian di Geoportal</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Otomatis: status <strong>Terisi</strong> jika Layer Utama dipilih, <strong>Belum Terisi</strong> jika belum dipilih.
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold select-none shadow-xs ${
                statusKeterisian
                  ? "bg-emerald-600 text-white shadow-emerald-600/20"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800"
              }`}
            >
              {statusKeterisian ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Terisi
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Belum Terisi
                </>
              )}
            </div>
          </div>

          {/* 2. Nama Data Geospasial */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Nama Data Geospasial
            </label>
            <Input
              value={namaData}
              onChange={(e) => setNamaData(e.target.value)}
              className="text-xs font-medium bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
              placeholder="Contoh: Peta Batas Administrasi..."
            />
          </div>

          {/* Tag / Bidang (Opsional) - Creatable Combobox */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Tag / Bidang (Opsional)
              </label>
              {tagBidang && (
                <button
                  type="button"
                  onClick={() => setTagBidang("")}
                  className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-0.5 cursor-pointer transition-colors"
                >
                  <X className="h-3 w-3" /> Hapus Tag
                </button>
              )}
            </div>
            <Popover open={openTagBidang} onOpenChange={setOpenTagBidang}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openTagBidang}
                    className="w-full justify-between text-left font-medium h-10 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs"
                  >
                    <span className="truncate">
                      {tagBidang || "-- Pilih atau Buat Tag / Bidang --"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent
                className="w-[--anchor-width] min-w-[340px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                align="start"
              >
                <Command>
                  <CommandInput
                    placeholder="Ketik untuk mencari atau membuat tag..."
                    className="text-xs"
                    value={tagSearch}
                    onValueChange={setTagSearch}
                  />
                  <CommandList className="max-h-[220px] overflow-y-auto">
                    <CommandEmpty className="p-3 text-xs text-center">
                      <div className="text-slate-500 mb-2">Tidak ada tag yang cocok.</div>
                      {tagSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setTagBidang(tagSearch.trim());
                            setTagSearch("");
                            setOpenTagBidang(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium text-xs cursor-pointer transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Buat tag &quot;{tagSearch.trim()}&quot;</span>
                        </button>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableTags.map((tag) => (
                        <CommandItem
                          key={tag}
                          value={tag}
                          onSelect={() => {
                            setTagBidang(tag);
                            setTagSearch("");
                            setOpenTagBidang(false);
                          }}
                          className="text-xs cursor-pointer py-1.5 focus:bg-slate-100 dark:focus:bg-slate-800"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5 text-blue-600 dark:text-blue-400",
                              tagBidang.toLowerCase() === tag.toLowerCase()
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {tag}
                          </span>
                        </CommandItem>
                      ))}

                      {tagSearch.trim() &&
                        !availableTags.some(
                          (t) => t.toLowerCase() === tagSearch.trim().toLowerCase()
                        ) && (
                          <CommandItem
                            value={tagSearch.trim()}
                            onSelect={() => {
                              setTagBidang(tagSearch.trim());
                              setTagSearch("");
                              setOpenTagBidang(false);
                            }}
                            className="text-xs cursor-pointer py-2 text-blue-600 dark:text-blue-400 font-medium border-t border-slate-100 dark:border-slate-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/40"
                          >
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            <span>Buat tag &quot;{tagSearch.trim()}&quot;</span>
                          </CommandItem>
                        )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 3. Tahun Berlaku Management: mengikuti Pengaturan Tahun */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Tahun Berlaku:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {yearOptions.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => toggleYear(y)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    years.includes(y)
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Cascading KUGI Selection (Crucial Two-Step Process with Partial Save Support) */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Standar KUGI (Pemilihan 2 Langkah)
              </label>
              {(selectedNamaUnsur || selectedKugiId) && (
                <button
                  type="button"
                  onClick={handleResetKugi}
                  className="text-[11px] text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" /> Reset KUGI
                </button>
              )}
            </div>

            {/* Step 1 (Nama Unsur): Searchable Popover + Command Combobox */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Langkah 1: Pilih Nama Unsur
              </label>
              <Popover open={openNamaUnsur} onOpenChange={setOpenNamaUnsur}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openNamaUnsur}
                      className="w-full justify-between text-left font-medium h-10 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs"
                    >
                      <span className="truncate">
                        {selectedNamaUnsur || "-- Cari & Pilih Nama Unsur KUGI --"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  }
                />
                <PopoverContent className="w-[--anchor-width] min-w-[340px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" align="start">
                  <Command>
                    <CommandInput placeholder="Ketik untuk mencari Nama Unsur..." className="text-xs" />
                    <CommandList className="max-h-[250px] overflow-y-auto">
                      <CommandEmpty className="p-3 text-xs text-slate-500 text-center">
                        Nama unsur tidak ditemukan.
                      </CommandEmpty>
                      <CommandGroup>
                        {uniqueNamaUnsur.map((nama) => (
                          <CommandItem
                            key={nama}
                            value={nama}
                            onSelect={() => {
                              handleSelectNamaUnsur(nama);
                              setOpenNamaUnsur(false);
                            }}
                            className="text-xs cursor-pointer py-1.5 focus:bg-slate-100 dark:focus:bg-slate-800"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3.5 w-3.5 text-blue-600 dark:text-blue-400",
                                selectedNamaUnsur === nama ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{nama}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Step 2 (Kode Unsur): Dependent Dropdown (Optional for partial saves) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Langkah 2: Pilih Kode Unsur &amp; Katalog (Opsional)
                </label>
                {!selectedNamaUnsur ? (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    (Wajib selesaikan Langkah 1 terlebih dahulu)
                  </span>
                ) : !selectedKugiId ? (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    (Boleh dikosongkan untuk simpan sebagian)
                  </span>
                ) : null}
              </div>
              <select
                value={selectedKugiId || ""}
                onChange={(e) => setSelectedKugiId(e.target.value || null)}
                disabled={!selectedNamaUnsur || availableKodeUnsurList.length === 0}
                className="w-full h-10 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="">-- Lewati atau Pilih Kode Unsur &amp; Katalog --</option>
                {availableKodeUnsurList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.kode_unsur} {k.katalog_unsur ? `(${k.katalog_unsur})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected KUGI Preview Card or Partial Save Indicator */}
            {selectedKugi ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border border-border dark:border-slate-800 rounded-xl space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{selectedKugi.nama_unsur}</span>
                    <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-800 border-border dark:border-slate-700 text-blue-600 dark:text-blue-400 font-mono">
                      {selectedKugi.kode_unsur}
                    </Badge>
                  </div>
                  {selectedKugi.katalog_unsur && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {selectedKugi.katalog_unsur}
                    </span>
                  )}
                </div>
                {selectedKugi.definisi && (
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {selectedKugi.definisi}
                  </p>
                )}
              </div>
            ) : selectedNamaUnsur ? (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>Nama Unsur: <strong className="text-slate-800 dark:text-slate-200">{selectedNamaUnsur}</strong></span>
                <span className="text-xs text-muted-foreground">(Kode belum ditentukan)</span>
              </div>
            ) : null}
          </div>

          {/* 5. Searchable Layer Utama (Unrestricted Scroll) & Layer Pelengkap */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Layer Utama (Searchable Combobox)
                </label>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  {opdStrictLayers.length} layer tersedia dari @{opdUsername || "OPD"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hanya menampilkan layer Geoportal yang diunggah oleh <strong>@{opdUsername || "OPD"}</strong>.
              </p>
            </div>

            {!opdUsername ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Perangkat Daerah ini belum memiliki username JIGD terdaftar.</span>
              </div>
            ) : opdStrictLayers.length === 0 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400">
                Tidak ditemukan layer di Geoportal dengan pemilik <strong>@{opdUsername}</strong>.
              </div>
            ) : (
              <>
                {/* Searchable Layer Utama Combobox (Popover + Command) */}
                <Popover open={openLayerUtama} onOpenChange={setOpenLayerUtama}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openLayerUtama}
                        className="w-full justify-between text-left font-normal h-10 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs"
                      >
                        <span className="truncate">
                          {selectedLayerUtama
                            ? `${selectedLayerUtama.title} (${selectedLayerUtama.geometry_type || "Layer"} • ${selectedLayerUtama.attribute_count || 0} atribut)`
                            : "-- Pilih Layer Utama (Ketik untuk mencari atau gulir) --"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    }
                  />
                  <PopoverContent className="w-[--anchor-width] min-w-[360px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" align="start">
                    <Command>
                      <CommandInput placeholder="Ketik untuk mencari layer..." className="text-xs" />
                      {/* CRITICAL: Unrestricted scroll list - no slicing or limits */}
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        <CommandEmpty className="p-3 text-xs text-slate-500 text-center">
                          Layer tidak ditemukan.
                        </CommandEmpty>
                        <CommandGroup>
                          {/* Option to clear */}
                          <CommandItem
                            value="__clear_layer_selection__"
                            onSelect={() => {
                              handleLayerUtamaChange("");
                              setOpenLayerUtama(false);
                            }}
                            className="text-xs text-rose-600 cursor-pointer py-2 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                          >
                            <X className="h-3.5 w-3.5 mr-2 text-rose-500" />
                            <span>-- Tidak Ada / Hapus Layer Utama --</span>
                          </CommandItem>

                          {/* Render ALL available layers for that OPD without slicing */}
                          {opdStrictLayers.map((layer) => (
                            <CommandItem
                              key={layer.uuid}
                              value={`${layer.title} ${layer.name} ${layer.geometry_type}`}
                              onSelect={() => {
                                handleLayerUtamaChange(layer.uuid);
                                setOpenLayerUtama(false);
                              }}
                              className="text-xs cursor-pointer py-2 focus:bg-slate-100 dark:focus:bg-slate-800"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400",
                                  layerUtamaUuid === layer.uuid ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{layer.title}</span>
                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                  {layer.name} • {layer.geometry_type} • {layer.attribute_count || 0} atribut
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {layerUtamaUuid && selectedLayerUtama && (
                  <div className="flex items-center justify-between text-[11px] text-blue-900 dark:text-blue-200 bg-blue-50/70 dark:bg-blue-950/50 p-2 rounded-lg border border-blue-200 dark:border-blue-900">
                    <span className="flex items-center gap-1 font-semibold">
                      <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Layer Utama Terpaut
                    </span>
                    <a
                      href={`https://jigd.kaltimprov.go.id/catalogue/#/dataset/${selectedLayerUtama.id_dataset}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <span>Lihat di Geoportal</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Layer Pelengkap Searchable Multi-Select Combobox */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Layer Pelengkap ({layerPelengkapUuids.length} layer terpilih)
                    </label>
                    <span className="text-[11px] text-slate-400 font-normal">Searchable Multi-Select</span>
                  </div>

                  {availablePelengkapLayers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                      Tidak ada layer lain milik @{opdUsername} untuk dijadikan pelengkap.
                    </p>
                  ) : (
                    <>
                      {/* Searchable Combobox Popover */}
                      <Popover open={openLayerPelengkap} onOpenChange={setOpenLayerPelengkap}>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openLayerPelengkap}
                              className="w-full justify-between text-left font-normal h-10 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs"
                            >
                              <span className="truncate">
                                {layerPelengkapUuids.length > 0
                                  ? `${layerPelengkapUuids.length} layer pelengkap terpilih`
                                  : "-- Ketik untuk mencari & memilih layer pelengkap --"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          }
                        />
                        <PopoverContent className="w-[--anchor-width] min-w-[360px] p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" align="start">
                          <Command>
                            <CommandInput placeholder="Ketik untuk mencari layer pelengkap..." className="text-xs" />
                            <CommandList className="max-h-[260px] overflow-y-auto">
                              <CommandEmpty className="p-3 text-xs text-slate-500 text-center">
                                Layer pelengkap tidak ditemukan.
                              </CommandEmpty>
                              <CommandGroup>
                                {availablePelengkapLayers.map((layer) => {
                                  const isChecked = layerPelengkapUuids.includes(layer.uuid);
                                  return (
                                    <CommandItem
                                      key={layer.uuid}
                                      value={`${layer.title} ${layer.name} ${layer.geometry_type}`}
                                      onSelect={() => togglePelengkapLayer(layer.uuid)}
                                      className="text-xs cursor-pointer py-2 focus:bg-slate-100 dark:focus:bg-slate-800"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400",
                                          isChecked ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{layer.title}</span>
                                        <span className="text-[10px] text-slate-400 font-mono truncate">
                                          {layer.name} • {layer.geometry_type} • {layer.attribute_count || 0} atribut
                                        </span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {/* Removable Badges below input */}
                      {layerPelengkapUuids.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg max-h-36 overflow-y-auto">
                          {layerPelengkapUuids.map((uuid) => {
                            const lObj = opdStrictLayers.find((l) => l.uuid === uuid);
                            const title = lObj?.title || lObj?.name || uuid;
                            return (
                              <Badge
                                key={uuid}
                                variant="outline"
                                className="pl-2 pr-1 py-0.5 text-[11px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1 max-w-full"
                              >
                                <span className="truncate max-w-[220px]" title={title}>
                                  {title}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removePelengkapLayer(uuid);
                                  }}
                                  className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-0.5 cursor-pointer text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Hapus layer ini"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Verifikasi"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
