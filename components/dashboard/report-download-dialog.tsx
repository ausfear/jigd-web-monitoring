"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/lembar-peta";
import { cn } from "@/lib/utils";
import type { DaftarData } from "@/types/database";
import { useDialogState } from "@/lib/use-dialog-state";

interface ReportDownloadDialogProps {
  /** Tahun yang bisa dipilih, terbaru lebih dulu. */
  years: number[];
  defaultYear: number;
  dataList: DaftarData[];
  /** Dikendalikan dari luar (menu Pengaturan): tombol pemicu tidak ditampilkan. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function hariIni(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Ambil nama file dari header Content-Disposition (utamakan filename* yang UTF-8). */
function namaFileDariHeader(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}

/**
 * Unduh laporan "Tingkat Keterisian Data pada Portal JIGD" (.docx) dengan format
 * dokumen resmi. Isi tabel disusun di server dari data terbaru untuk tahun terpilih.
 */
export function ReportDownloadDialog({ years, defaultYear, dataList, open, onOpenChange }: ReportDownloadDialogProps) {
  const [tahun, setTahun] = useState(defaultYear);
  const [tanggal, setTanggal] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ringkasan = useMemo(() => {
    const rows = dataList.filter((d) => Array.isArray(d.tahun_berlaku) && d.tahun_berlaku.includes(tahun));
    return {
      total: rows.length,
      terisi: rows.filter((d) => d.status_keterisian).length,
      opd: new Set(rows.map((d) => d.opd_id)).size,
    };
  }, [dataList, tahun]);

  const { isOpen, setIsOpen, controlled } = useDialogState(open, onOpenChange, () => {
    setTahun(defaultYear);
    setTanggal(hariIni());
    setErrorMessage(null);
  });

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!tanggal) {
      setErrorMessage("Pilih tanggal update terlebih dahulu.");
      return;
    }

    try {
      setIsGenerating(true);
      const params = new URLSearchParams({ tahun: String(tahun), tanggal });
      const res = await fetch(`/api/laporan-keterisian?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server membalas HTTP ${res.status}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFileDariHeader(res.headers.get("Content-Disposition")) ?? "Laporan Keterisian JIGD.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setIsOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {!controlled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="h-9 border-ink bg-transparent px-3 text-sm text-ink hover:bg-ink/5"
        >
          <FileDown className="h-4 w-4 mr-1.5" />
          Unduh Laporan
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(o) => !isGenerating && setIsOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <FileDown className="h-5 w-5 text-qty" />
              Unduh laporan keterisian
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-2">
              Dokumen Word &ldquo;Tingkat Keterisian Data pada Portal JIGD&rdquo; dengan format resmi. Isi tabel
              diambil dari data terbaru di database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDownload} className="space-y-4 py-2">
            {errorMessage && (
              <div role="alert" className="flex items-start gap-2 border border-bound border-l-4 p-3 text-sm text-bound">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="laporan-tahun" className="text-sm font-semibold text-ink">
                  Tahun daftar data
                </label>
                <select
                  id="laporan-tahun"
                  value={tahun}
                  onChange={(e) => setTahun(Number(e.target.value))}
                  disabled={isGenerating}
                  className={cn(controlClass, "w-full cursor-pointer")}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="laporan-tanggal" className="text-sm font-semibold text-ink">
                  Tanggal update
                </label>
                <input
                  id="laporan-tanggal"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  disabled={isGenerating}
                  required
                  className={cn(controlClass, "w-full")}
                />
              </div>
            </div>

            <p className="text-sm text-ink-2">
              {ringkasan.total > 0 ? (
                <>
                  Berisi {ringkasan.total} daftar data dari {ringkasan.opd} OPD: {ringkasan.terisi} terisi,{" "}
                  {ringkasan.total - ringkasan.terisi} belum terisi. Tanggal dipakai untuk baris &ldquo;Update&rdquo;
                  dan tanggal tanda tangan.
                </>
              ) : (
                <span className="text-bound">Belum ada daftar data untuk tahun {tahun}.</span>
              )}
            </p>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isGenerating}
                className="border-rule"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isGenerating || ringkasan.total === 0}
                className="bg-qty hover:bg-qty/90 text-sheet font-medium"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Menyusun dokumen…
                  </>
                ) : (
                  "Unduh .docx"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
