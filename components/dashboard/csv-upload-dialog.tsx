"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Calendar,
  Sparkles,
  RefreshCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDialogState } from "@/lib/use-dialog-state";
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
  /** Tahun yang terisi otomatis saat dialog dibuka (tahun aktif terbaru). */
  defaultYear: number;
  onSuccess: () => void;
  /** Dikendalikan dari luar (menu Pengaturan): tombol pemicu tidak ditampilkan. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "default" | "sm";
  className?: string;
}

export function CsvUploadDialog({ opdList, defaultYear, onSuccess, size = "sm", className, open, onOpenChange }: CsvUploadDialogProps) {
  const [isParsing, setIsParsing] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // File parsing states
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [mappings, setMappings] = useState<ProducerMapping[]>([]);
  const [tahunBerlaku, setTahunBerlaku] = useState<string>(String(defaultYear));

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFileName(null);
    setParsedRows([]);
    setMappings([]);
    setTahunBerlaku(String(defaultYear));
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

  const { isOpen, setIsOpen, controlled } = useDialogState(open, onOpenChange, () =>
    setTahunBerlaku(String(defaultYear))
  );

  return (
    <>
      {!controlled && (
        <Button
          variant="outline"
          size={size}
          onClick={() => setIsOpen(true)}
          className={cn(
            "h-9 border-ink bg-transparent px-3 text-sm text-ink hover:bg-ink/5",
            className
          )}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Unggah CSV
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-qty" />
            Upload &amp; Smart Mapper Daftar Data (CSV)
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Unggah file CSV daftar data. Sistem akan memetakan produsen data ke Master OPD secara otomatis dengan algoritma fuzzy-matching.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-bound/10 border border-bound/40 text-bound rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-bound mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: CSV FILE SELECTION */}
        {parsedRows.length === 0 ? (
          <div className="py-6 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-ink/30 hover:border-qty rounded-xl p-8 text-center cursor-pointer transition-colors bg-sheet hover:bg-ink/5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-qty/10 flex items-center justify-center text-qty mb-1">
                  {isParsing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                </div>
                <div className="text-sm font-semibold text-ink">
                  {isParsing ? "Sedang memproses CSV..." : "Pilih atau Tarik Berkas CSV ke Sini"}
                </div>
                <p className="text-sm text-ink-2 max-w-sm">
                  Format yang didukung: CSV dengan kolom <strong>Nama Data</strong> dan <strong>Produsen Data</strong>.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-sheet border border-rule rounded-lg text-sm text-ink-2 space-y-1">
              <span className="font-semibold text-ink">Tips Format CSV:</span>
              <p>Baris pertama berisi nama kolom. Contoh: <code className="bg-ink/10 px-1 py-0.5 rounded text-ink">Nama Data, Produsen Data</code></p>
            </div>
          </div>
        ) : (
          /* STEP 2: SMART MAPPER UI */
          <div className="space-y-5 py-2">
            {/* Top Bar: File & Year */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-sheet border border-rule rounded-xl">
              <div>
                <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-qty" />
                  <span>{fileName}</span>
                </div>
                <p className="text-[13px] text-ink-2 mt-0.5">
                  Ditemukan <strong>{parsedRows.length}</strong> baris data dengan <strong>{mappings.length}</strong> produsen unik.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-ink whitespace-nowrap flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-qty" />
                  Tahun Berlaku:
                </label>
                <Input
                  type="number"
                  value={tahunBerlaku}
                  onChange={(e) => setTahunBerlaku(e.target.value)}
                  className="w-24 h-8 text-sm bg-sheet border-rule focus-visible:ring-qty/30 font-semibold text-center"
                  placeholder={String(defaultYear)}
                  required
                />
              </div>
            </div>

            {/* Smart Mapper Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-qty" />
                  Pemetaan Produsen CSV ke Master OPD
                </span>
                <span className="text-[13px] text-ink-2">
                  {unmappedCount > 0 ? (
                    <span className="text-bound font-semibold">{unmappedCount} produsen belum terpetakan</span>
                  ) : (
                    <span className="text-done font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Semua produsen terpetakan
                    </span>
                  )}
                </span>
              </div>

              <div className="border border-rule rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sheet border-b border-rule sticky top-0 z-10 text-ink">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Produsen di CSV</th>
                      <th className="py-2.5 px-2 font-semibold text-center w-24">Jumlah</th>
                      <th className="py-2.5 px-3 font-semibold min-w-[240px]">Petakan ke Master OPD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {mappings.map((m) => (
                      <tr key={m.producerName} className="hover:bg-ink/5">
                        <td className="py-2.5 px-3 font-medium text-ink align-middle">
                          <div>{m.producerName}</div>
                          {m.isAutoMatched && (
                            <Badge variant="outline" className="text-xs text-qty border-qty/40 bg-qty/10 mt-1 py-0">
                              Otomatis
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center text-ink-2 align-middle">
                          <span className="bg-ink/5 text-ink px-2 py-0.5 font-semibold text-[13px]">
                            {m.count}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <select
                            value={m.matchedOpdId}
                            onChange={(e) => handleMappingChange(m.producerName, e.target.value)}
                            className={`w-full h-8 rounded-md border text-sm font-medium px-2 outline-none transition-colors ${
                              m.matchedOpdId
                                ? "border-ink/30 bg-sheet text-ink focus:border-qty"
                                : "border-bound/40 bg-bound/10 text-bound"
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
                className="text-ink-2 hover:text-ink text-sm"
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
                  className="border-rule"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkInsert}
                  disabled={isInserting || unmappedCount > 0}
                  className="bg-qty hover:bg-qty/90 text-sheet font-semibold"
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
