"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useDialogState } from "@/lib/use-dialog-state";
import type { CacheLayerGeoportal, MasterKugi, MasterOpd, RiwayatPerubahan } from "@/types/database";

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opdList: MasterOpd[];
  kugiList: MasterKugi[];
  layerMap: Map<string, CacheLayerGeoportal>;
}

const PER_HALAMAN = 50;

/** Ambil satu halaman riwayat (di luar komponen: tidak menyentuh state React). */
function loadRiwayat(from: number) {
  return supabase
    .from("riwayat_perubahan")
    .select("id, waktu, aksi, data_id, nama_data, opd_id, perubahan, pengguna")
    .order("waktu", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PER_HALAMAN - 1)
    .returns<RiwayatPerubahan[]>();
}

const LABEL_KOLOM: Record<string, string> = {
  nama_data: "Nama data",
  opd_id: "OPD",
  kugi_id: "Kode KUGI",
  kugi_nama_unsur: "KUGI",
  tag_bidang: "Tag bidang",
  tahun_berlaku: "Tahun",
  layer_utama_uuid: "Layer utama",
  layer_pelengkap_uuids: "Layer pelengkap",
};

const LABEL_AKSI: Record<RiwayatPerubahan["aksi"], string> = {
  tambah: "Ditambahkan",
  ubah: "Diubah",
  hapus: "Dihapus",
  urutan: "Urutan diatur",
};

const formatWaktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Riwayat tambah, ubah, dan hapus daftar data (tabel riwayat_perubahan, diisi trigger database). */
export function HistoryDialog({ open, onOpenChange, opdList, kugiList, layerMap }: HistoryDialogProps) {
  const [rows, setRows] = useState<RiwayatPerubahan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isOpen, setIsOpen } = useDialogState(open, onOpenChange, () => {
    setRows([]);
    setIsLoading(true);
    setErrorMessage(null);
  });

  const terapkan = (from: number) => (res: Awaited<ReturnType<typeof loadRiwayat>>) => {
    if (res.error) {
      setErrorMessage(
        res.error.message.includes("riwayat_perubahan")
          ? "Tabel riwayat belum ada. Jalankan migrations/2026-10-31_usulan_merge_dan_riwayat.sql di Supabase SQL Editor."
          : res.error.message
      );
    } else {
      const data = res.data ?? [];
      setRows((prev) => (from === 0 ? data : [...prev, ...data]));
      setHasMore(data.length === PER_HALAMAN);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    let batal = false;
    loadRiwayat(0).then((res) => {
      if (!batal) terapkan(0)(res);
    });
    return () => {
      batal = true;
    };
  }, [isOpen]);

  const muatLagi = () => {
    setIsLoading(true);
    loadRiwayat(rows.length).then(terapkan(rows.length));
  };

  const opdName = new Map(opdList.map((o) => [o.id, o.nama_opd]));
  const kugiById = new Map(kugiList.map((k) => [k.id, k]));

  const formatNilai = (kolom: string, nilai: unknown): string => {
    if (nilai === null || nilai === undefined || nilai === "" || (Array.isArray(nilai) && nilai.length === 0)) {
      return "kosong";
    }
    const layer = (uuid: string) => {
      const l = layerMap.get(uuid);
      return l ? l.title || l.name : "layer yang sudah dihapus";
    };
    switch (kolom) {
      case "opd_id":
        return opdName.get(String(nilai)) || "OPD tidak dikenal";
      case "kugi_id": {
        const k = kugiById.get(String(nilai));
        return k ? `${k.kode_unsur} (${k.nama_unsur})` : "kode tidak dikenal";
      }
      case "layer_utama_uuid":
        return layer(String(nilai));
      case "layer_pelengkap_uuids":
        return (nilai as string[]).map(layer).join(", ");
      case "tahun_berlaku":
        return (nilai as number[]).join(", ");
      default:
        return String(nilai);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
            <History className="h-5 w-5 text-qty" />
            Riwayat perubahan
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Setiap penambahan, perubahan, dan penghapusan daftar data, terbaru di atas.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div role="alert" className="flex items-start gap-2 border border-bound border-l-4 p-3 text-sm text-bound">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto border-y border-rule">
          {rows.length === 0 && isLoading ? (
            <SkeletonRows rows={6} />
          ) : rows.length === 0 && !errorMessage ? (
            <p className="py-10 text-center text-sm text-ink-2">Belum ada perubahan yang tercatat.</p>
          ) : (
            <ol className="divide-y divide-rule">
              {rows.map((r) => {
                const kolom = Object.entries(r.perubahan || {}).filter(([k]) => k in LABEL_KOLOM);
                return (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-sm text-ink">
                        <span className={r.aksi === "hapus" ? "text-bound" : "text-qty"}>{LABEL_AKSI[r.aksi]}</span>
                        {r.nama_data && <span className="font-semibold">{`: ${r.nama_data}`}</span>}
                      </p>
                      <p className="text-[13px] text-ink-2 tabular-nums">{formatWaktu(r.waktu)}</p>
                    </div>
                    <p className="text-[13px] text-ink-2">
                      {r.opd_id && <>{opdName.get(r.opd_id) || "OPD tidak dikenal"}, </>}
                      oleh {r.pengguna || "SQL Editor / sistem"}
                    </p>
                    {r.aksi === "urutan" ? (
                      <p className="mt-1 text-[13px] text-ink">
                        {Number((r.perubahan?.urutan as { baru?: unknown } | undefined)?.baru) || 0} daftar data berpindah posisi.
                      </p>
                    ) : (
                      kolom.length > 0 && (
                        <dl className="mt-1.5 space-y-0.5 text-[13px]">
                          {kolom.map(([k, v]) => (
                            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2">
                              <dt className="text-ink-2">{LABEL_KOLOM[k]}</dt>
                              <dd className="min-w-0 break-words text-ink">
                                {r.aksi === "tambah" ? (
                                  formatNilai(k, v.baru)
                                ) : r.aksi === "hapus" ? (
                                  formatNilai(k, v.lama)
                                ) : (
                                  <>
                                    <span className="text-ink-2 line-through decoration-ink-2/50">{formatNilai(k, v.lama)}</span>
                                    {" → "}
                                    {formatNilai(k, v.baru)}
                                  </>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={muatLagi}
              disabled={isLoading}
              className="h-8 border-ink/40 bg-transparent text-ink hover:bg-ink/5"
            >
              {isLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Muat lebih banyak
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
