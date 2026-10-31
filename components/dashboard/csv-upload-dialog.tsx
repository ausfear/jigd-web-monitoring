"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  Building2, 
  Calendar,
  Sparkles,
  RefreshCcw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MasterOpd } from "@/types/database";
import { findBestOpdMatch } from "@/lib/fuzzy-matcher";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface CsvRow {
  nama_data: string;
  produsen_raw: string;
}

interface ProducerMapping {
  producerName: string;
  count: number;
  matchedOpdId: string;
  matchScore: number;
  isAutoMatched: boolean;
}

interface CsvUploadDialogProps {
  opdList: MasterOpd[];
  onSuccess: () => void;
  size?: "default" | "sm";
  className?: string;
}

export function CsvUploadDialog({ opdList, onSuccess, size = "sm", className }: CsvUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File parsing states
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [mappings, setMappings] = useState<ProducerMapping[]>([]);
  const [tahunBerlaku, setTahunBerlaku] = useState<string>("2026");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFileName(null);
    setParsedRows([]);
    setMappings([]);
    setTahunBerlaku("2026");
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /**
   * Parse CSV content and detect columns
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsParsing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          throw new Error("Berkas CSV kosong.");
        }

        // Split lines and handle delimiters (, or ;)
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          throw new Error("Berkas CSV harus memiliki minimal 1 baris header dan 1 baris data.");
        }

        // Determine separator: check first line for ';' or ','
        const separator = lines[0].includes(";") ? ";" : ",";

        // Parse CSV line handling quotes
        const parseLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
              result.push(current.trim().replace(/^"|"$/g, ""));
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim().replace(/^"|"$/g, ""));
          return result;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase());

        // Locate column indexes for Nama Data and Produsen Data
        const isProducerHeader = (h: string) =>
          h.includes("produsen") || h.includes("opd") || h.includes("perangkat") || h.includes("walidata") || h.includes("instansi");
        // Exclude producer headers so "Produsen Data" is not mistaken for the data-name column
        let nameIdx = headers.findIndex(h =>
          !isProducerHeader(h) &&
          (h.includes("nama") || h.includes("data") || h.includes("dataset") || h.includes("judul"))
        );
        let produsenIdx = headers.findIndex(isProducerHeader);

        // Fallback default: first column is name, second column is producer
        if (nameIdx === -1 && headers.length >= 1) nameIdx = 0;
        if (produsenIdx === -1 && headers.length >= 2) produsenIdx = 1;

        if (nameIdx === -1 || produsenIdx === -1 || nameIdx === produsenIdx) {
          throw new Error("Tidak dapat mendeteksi kolom 'Nama Data' dan 'Produsen Data'. Pastikan header CSV memiliki nama kolom yang sesuai.");
        }

        const rows: CsvRow[] = [];
        const producerCounts = new Map<string, number>();

        for (let i = 1; i < lines.length; i++) {
          const cols = parseLine(lines[i]);
          if (cols.length <= Math.max(nameIdx, produsenIdx)) continue;

          const nama_data = cols[nameIdx];
          const produsen_raw = cols[produsenIdx];

          if (nama_data && produsen_raw) {
            rows.push({ nama_data, produsen_raw });
            producerCounts.set(produsen_raw, (producerCounts.get(produsen_raw) || 0) + 1);
          }
        }

        if (rows.length === 0) {
          throw new Error("Tidak ditemukan data valid pada berkas CSV.");
        }

        // Generate Smart Mappings with Fuzzy Matching
        const initialMappings: ProducerMapping[] = Array.from(producerCounts.entries()).map(
          ([producerName, count]) => {
            const { opd, score } = findBestOpdMatch(producerName, opdList);
            return {
              producerName,
              count,
              matchedOpdId: opd ? opd.id : "",
              matchScore: score,
              isAutoMatched: Boolean(opd && score >= 0.5),
            };
          }
        );

        setParsedRows(rows);
        setMappings(initialMappings);
      } catch (err) {
        console.error("CSV parse error:", err);
        setErrorMessage(err instanceof Error ? err.message : "Gagal memproses file CSV.");
        setParsedRows([]);
        setMappings([]);
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage("Gagal membaca berkas CSV.");
      setIsParsing(false);
    };

    reader.readAsText(file);
  };

  /**
   * Update selected OPD for a specific producer mapping
   */
  const handleMappingChange = (producerName: string, opdId: string) => {
    setMappings(prev =>
      prev.map(m =>
        m.producerName === producerName
          ? { ...m, matchedOpdId: opdId, isAutoMatched: false }
          : m
      )
    );
  };

  /**
   * Bulk insert verified rows into daftar_data
   */
  const handleBulkInsert = async () => {
    setErrorMessage(null);

    const yearInt = parseInt(tahunBerlaku, 10);
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      setErrorMessage("Tahun berlaku tidak valid. Masukkan format tahun (contoh: 2026).");
      return;
    }

    // Check if any mapping is unassigned
    const unmapped = mappings.filter(m => !m.matchedOpdId);
    if (unmapped.length > 0) {
      setErrorMessage(
        `Ada ${unmapped.length} produsen yang belum dipetakan ke Perangkat Daerah. Silakan tentukan OPD untuk semua produsen.`
      );
      return;
    }

    // Build lookup map: producerName -> opdId
    const mapLookup = new Map<string, string>();
    mappings.forEach(m => mapLookup.set(m.producerName, m.matchedOpdId));

    try {
      setIsInserting(true);

      const recordsToInsert = parsedRows.map(row => ({
        nama_data: row.nama_data,
        opd_id: mapLookup.get(row.produsen_raw)!,
        tahun_berlaku: [yearInt],
        status_keterisian: false,
        layer_pelengkap_uuids: [],
      }));

      // Chunk inserts in batches of 100
      const CHUNK_SIZE = 100;
      for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from("daftar_data").insert(chunk);
        if (error) throw error;
      }

      resetState();
      setIsOpen(false);
      onSuccess();
    } catch (err) {
      console.error("Bulk insert error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal mengimpor data ke database.");
    } finally {
      setIsInserting(false);
    }
  };

  const unmappedCount = mappings.filter(m => !m.matchedOpdId).length;

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => setIsOpen(true)}
        className={cn(
          "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs text-xs font-medium",
          className
        )}
      >
        <Upload className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
        Upload Daftar Data (CSV)
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Upload &amp; Smart Mapper Daftar Data (CSV)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Unggah file CSV daftar data. Sistem akan memetakan produsen data ke Master OPD secara otomatis dengan algoritma fuzzy-matching.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: CSV FILE SELECTION */}
        {parsedRows.length === 0 ? (
          <div className="py-6 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-1">
                  {isParsing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isParsing ? "Sedang memproses CSV..." : "Pilih atau Tarik Berkas CSV ke Sini"}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Format yang didukung: CSV dengan kolom <strong>Nama Data</strong> dan <strong>Produsen Data</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Tips Format CSV:</span>
              <p>Baris pertama berisi nama kolom. Contoh: <code className="bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200 font-mono">Nama Data, Produsen Data</code></p>
            </div>
          </div>
        ) : (
          /* STEP 2: SMART MAPPER UI */
          <div className="space-y-5 py-2">
            {/* Top Bar: File & Year */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>{fileName}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ditemukan <strong>{parsedRows.length}</strong> baris data dengan <strong>{mappings.length}</strong> produsen unik.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Tahun Berlaku:
                </label>
                <Input
                  type="number"
                  value={tahunBerlaku}
                  onChange={(e) => setTahunBerlaku(e.target.value)}
                  className="w-24 h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500 font-semibold text-center"
                  placeholder="2026"
                  required
                />
              </div>
            </div>

            {/* Smart Mapper Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Pemetaan Produsen CSV ke Master OPD
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {unmappedCount > 0 ? (
                    <span className="text-rose-600 font-semibold">{unmappedCount} produsen belum terpetakan</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Semua produsen terpetakan
                    </span>
                  )}
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Produsen di CSV</th>
                      <th className="py-2.5 px-2 font-semibold text-center w-24">Jumlah</th>
                      <th className="py-2.5 px-3 font-semibold min-w-[240px]">Petakan ke Master OPD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mappings.map((m) => (
                      <tr key={m.producerName} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 align-middle">
                          <div>{m.producerName}</div>
                          {m.isAutoMatched && (
                            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-800 dark:bg-blue-950/60 mt-1 py-0">
                              Otomatis
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 align-middle">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                            {m.count}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <select
                            value={m.matchedOpdId}
                            onChange={(e) => handleMappingChange(m.producerName, e.target.value)}
                            className={`w-full h-8 rounded-md border text-xs font-medium px-2 outline-none transition-colors ${
                              m.matchedOpdId
                                ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-500"
                                : "border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200"
                            }`}
                          >
                            <option value="">-- Pilih Master OPD --</option>
                            {opdList.map((opd) => (
                              <option key={opd.id} value={opd.id}>
                                {opd.nama_opd} {opd.username_jigd ? `(${opd.username_jigd})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetState}
                disabled={isInserting}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Unggah Ulang File Lain
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  disabled={isInserting}
                  className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkInsert}
                  disabled={isInserting || unmappedCount > 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                >
                  {isInserting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Mengimpor...
                    </>
                  ) : (
                    <>
                      <span>Impor {parsedRows.length} Data</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      </Dialog>
    </>
  );
}
