"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ChevronRight, GripVertical, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useDialogState } from "@/lib/use-dialog-state";
import type { DaftarData, MasterOpd } from "@/types/database";

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Daftar data, sudah terurut menurut `urutan`. */
  dataList: DaftarData[];
  opdList: MasterOpd[];
  onSuccess: () => void;
}

interface Susunan {
  opdIds: string[];
  dataByOpd: Record<string, string[]>;
}

const TANPA_OPD = "-";

function susunAwal(dataList: DaftarData[]): Susunan {
  const opdIds: string[] = [];
  const dataByOpd: Record<string, string[]> = {};
  for (const d of dataList) {
    const key = d.opd_id || TANPA_OPD;
    if (!dataByOpd[key]) {
      dataByOpd[key] = [];
      opdIds.push(key);
    }
    dataByOpd[key].push(d.id);
  }
  return { opdIds, dataByOpd };
}

function pindahkan<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Jalankan pembaruan per kelompok kecil agar tidak membanjiri Supabase. */
async function updateBertahap(
  rows: { id: string; urutan: number }[],
  onProgress: (done: number) => void
) {
  const UKURAN = 10;
  for (let i = 0; i < rows.length; i += UKURAN) {
    const batch = rows.slice(i, i + UKURAN);
    const results = await Promise.all(
      batch.map((r) => supabase.from("daftar_data").update({ urutan: r.urutan }).eq("id", r.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    onProgress(Math.min(i + UKURAN, rows.length));
  }
}

type Seret = { jenis: "opd" } | { jenis: "data"; opdId: string };

/**
 * Atur urutan tampil daftar data: OPD lebih dulu, lalu daftar data di dalam OPD.
 * Urutan ini dipakai tabel Verifikasi, laporan Word, dan halaman publik; nomornya
 * sendiri tidak pernah ditampilkan.
 */
export function OrderDialog({ open, onOpenChange, dataList, opdList, onSuccess }: OrderDialogProps) {
  const [susunan, setSusunan] = useState<Susunan>({ opdIds: [], dataByOpd: {} });
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [berubah, setBerubah] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diseret, setDiseret] = useState<{ seret: Seret; id: string } | null>(null);

  const { isOpen, setIsOpen } = useDialogState(open, onOpenChange, () => {
    setSusunan(susunAwal(dataList));
    setTerbuka(null);
    setBerubah(false);
    setProgress(null);
    setErrorMessage(null);
  });

  const dataById = new Map(dataList.map((d) => [d.id, d]));
  const namaOpd = (id: string) =>
    id === TANPA_OPD ? "Tanpa OPD" : opdList.find((o) => o.id === id)?.nama_opd || "OPD tidak dikenal";
  const isSaving = progress !== null;

  const geserOpd = (from: number, to: number) => {
    setSusunan((s) => ({ ...s, opdIds: pindahkan(s.opdIds, from, to) }));
    setBerubah(true);
  };
  const geserData = (opdId: string, from: number, to: number) => {
    setSusunan((s) => ({ ...s, dataByOpd: { ...s.dataByOpd, [opdId]: pindahkan(s.dataByOpd[opdId], from, to) } }));
    setBerubah(true);
  };

  // Seret-lepas (desktop): urutan berubah langsung saat kursor melewati baris lain dalam daftar yang sama.
  const dragProps = (seret: Seret, id: string, index: number, list: string[]) => ({
    draggable: !isSaving,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      setDiseret({ seret, id });
    },
    onDragOver: (e: React.DragEvent) => {
      if (!diseret || diseret.seret.jenis !== seret.jenis) return;
      if (seret.jenis === "data" && diseret.seret.jenis === "data" && diseret.seret.opdId !== seret.opdId) return;
      e.preventDefault();
      e.stopPropagation();
      const from = list.indexOf(diseret.id);
      if (from === -1 || from === index) return;
      if (seret.jenis === "opd") geserOpd(from, index);
      else geserData(seret.opdId, from, index);
    },
    onDragEnd: () => setDiseret(null),
  });

  const handleSave = async () => {
    const urutanBaru = susunan.opdIds.flatMap((opdId) => susunan.dataByOpd[opdId]);
    const changed = urutanBaru
      .map((id, i) => ({ id, urutan: i + 1 }))
      .filter((r) => dataById.get(r.id)?.urutan !== r.urutan);

    if (changed.length === 0) {
      setIsOpen(false);
      return;
    }

    try {
      setErrorMessage(null);
      setProgress({ done: 0, total: changed.length });
      await updateBertahap(changed, (done) => setProgress({ done, total: changed.length }));
      // Satu catatan ringkas di riwayat (diabaikan bila tabel riwayat belum dibuat).
      await supabase
        .from("riwayat_perubahan")
        .insert({ aksi: "urutan", perubahan: { urutan: { lama: null, baru: changed.length } } });
      setIsOpen(false);
      onSuccess();
    } catch (err) {
      setErrorMessage((err as { message?: string })?.message || "Gagal menyimpan urutan.");
      onSuccess(); // sebagian baris mungkin sudah tersimpan
    } finally {
      setProgress(null);
    }
  };

  const tombolGeser = (label: string, onUp: () => void, onDown: () => void, first: boolean, last: boolean) => (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={onUp}
        disabled={first || isSaving}
        aria-label={`Naikkan ${label}`}
        title="Naikkan"
        className="p-1.5 text-ink-2 hover:text-ink hover:bg-ink/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={last || isSaving}
        aria-label={`Turunkan ${label}`}
        title="Turunkan"
        className="p-1.5 text-ink-2 hover:text-ink hover:bg-ink/10 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !isSaving && setIsOpen(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink">Atur urutan daftar data</DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Seret atau gunakan tombol panah untuk mengurutkan OPD, lalu buka sebuah OPD untuk mengurutkan daftar
            datanya. Urutan ini dipakai di tabel Verifikasi, laporan Word, dan halaman publik.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div role="alert" className="flex items-start gap-2 border border-bound border-l-4 p-3 text-sm text-bound">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <ol className="-mx-4 min-h-0 flex-1 overflow-y-auto border-y border-rule">
          {susunan.opdIds.map((opdId, oi) => {
            const items = susunan.dataByOpd[opdId] ?? [];
            const isOpenOpd = terbuka === opdId;
            const nama = namaOpd(opdId);
            return (
              <li
                key={opdId}
                {...dragProps({ jenis: "opd" }, opdId, oi, susunan.opdIds)}
                className={cn(
                  "border-b border-rule last:border-b-0",
                  diseret?.id === opdId && "bg-qty/10"
                )}
              >
                <div className="flex items-center gap-1 px-2 py-1.5 sm:px-3">
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-ink-2 sm:block" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setTerbuka(isOpenOpd ? null : opdId)}
                    aria-expanded={isOpenOpd}
                    className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left cursor-pointer"
                  >
                    <ChevronRight
                      className={cn("h-4 w-4 shrink-0 text-ink-2 transition-transform", isOpenOpd && "rotate-90")}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{nama}</span>
                      <span className="block text-[13px] text-ink-2">{items.length} daftar data</span>
                    </span>
                  </button>
                  {tombolGeser(
                    nama,
                    () => geserOpd(oi, oi - 1),
                    () => geserOpd(oi, oi + 1),
                    oi === 0,
                    oi === susunan.opdIds.length - 1
                  )}
                </div>

                {isOpenOpd && (
                  <ol className="mb-2 ml-7 mr-2 border-l-2 border-qty/40 sm:ml-10 sm:mr-3">
                    {items.map((id, di) => {
                      const d = dataById.get(id);
                      if (!d) return null;
                      return (
                        <li
                          key={id}
                          {...dragProps({ jenis: "data", opdId }, id, di, items)}
                          className={cn(
                            "flex items-center gap-1 border-b border-rule py-1 pl-2 last:border-b-0",
                            diseret?.id === id && "bg-qty/10"
                          )}
                        >
                          <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-ink-2 sm:block" aria-hidden="true" />
                          <span className="min-w-0 flex-1 py-0.5">
                            <span className="block text-sm text-ink">{d.nama_data}</span>
                            <span className="block text-[13px] text-ink-2 tabular-nums">
                              {(d.tahun_berlaku || []).join(", ") || "Tanpa tahun"}
                            </span>
                          </span>
                          {tombolGeser(
                            d.nama_data,
                            () => geserData(opdId, di, di - 1),
                            () => geserData(opdId, di, di + 1),
                            di === 0,
                            di === items.length - 1
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
            className="border-rule"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !berubah}
            className="bg-qty hover:bg-qty/90 text-sheet font-medium"
          >
            {progress ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Menyimpan {progress.done}/{progress.total}…
              </>
            ) : (
              "Simpan urutan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
