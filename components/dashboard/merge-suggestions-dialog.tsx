"use client";

import React, { useState } from "react";
import { AlertCircle, GitMerge, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { CacheLayerGeoportal, DaftarData, UsulanMerge } from "@/types/database";

interface MergeSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usulan: UsulanMerge[];
  dataList: DaftarData[];
  layerMap: Map<string, CacheLayerGeoportal>;
  /** Buka dialog Merge untuk pasangan ini (data -> target). */
  onReview: (data: DaftarData, target: DaftarData) => void;
  onChanged: () => void;
}

function Ringkasan({ judul, d, layerMap }: { judul: string; d: DaftarData; layerMap: Map<string, CacheLayerGeoportal> }) {
  const layer = d.layer_utama_uuid ? layerMap.get(d.layer_utama_uuid) : null;
  const kugi = d.master_kugi?.nama_unsur || d.kugi_nama_unsur;
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[13px] text-ink-2">{judul}</p>
      <p className="text-sm font-semibold text-ink">{d.nama_data}</p>
      <dl className="text-[13px] text-ink-2">
        <div><dt className="inline">Tahun: </dt><dd className="inline tabular-nums">{(d.tahun_berlaku || []).join(", ") || "-"}</dd></div>
        <div><dt className="inline">KUGI: </dt><dd className="inline">{kugi || "-"}</dd></div>
        <div className="break-all"><dt className="inline">Layer utama: </dt><dd className="inline">{layer ? layer.title || layer.name : d.layer_utama_uuid ? "tidak ada di Geoportal" : "-"}</dd></div>
      </dl>
    </div>
  );
}

/**
 * Daftar pasangan daftar data yang kemungkinan sama (tabel usulan_merge), misalnya hasil
 * impor tahun lain dengan nama yang sedikit berbeda. Usulan hilang sendiri setelah
 * di-merge (salah satu datanya terhapus) atau ditandai "Bukan data yang sama".
 */
export function MergeSuggestionsDialog({
  open,
  onOpenChange,
  usulan,
  dataList,
  layerMap,
  onReview,
  onChanged,
}: MergeSuggestionsDialogProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const byId = new Map(dataList.map((d) => [d.id, d]));
  const pasangan = usulan
    .map((u) => ({ u, data: byId.get(u.data_id), target: byId.get(u.target_id) }))
    .filter((p): p is { u: UsulanMerge; data: DaftarData; target: DaftarData } => Boolean(p.data && p.target))
    .sort((a, b) => (a.target.urutan ?? Infinity) - (b.target.urutan ?? Infinity));

  const tolak = async (u: UsulanMerge) => {
    try {
      setBusyId(u.id);
      setErrorMessage(null);
      const { error } = await supabase.from("usulan_merge").delete().eq("id", u.id);
      if (error) throw error;
      onChanged();
    } catch (err) {
      setErrorMessage((err as { message?: string })?.message || "Gagal menghapus usulan.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-qty" />
            Usulan merge
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Pasangan daftar data dengan nama mirip dalam OPD yang sama. Periksa tiap pasangan: gabungkan bila datanya
            sama, atau tandai bukan data yang sama agar usulan hilang.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div role="alert" className="flex items-start gap-2 border border-bound border-l-4 p-3 text-sm text-bound">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {pasangan.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-2">Tidak ada usulan merge yang menunggu.</p>
        ) : (
          <ul className="-mx-4 min-h-0 flex-1 overflow-y-auto border-y border-rule divide-y divide-rule">
            {pasangan.map(({ u, data, target }) => (
              <li key={u.id} className="px-4 py-4 space-y-3">
                <p className="text-[13px] text-ink-2">{data.master_opd?.nama_opd || target.master_opd?.nama_opd}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Ringkasan judul="Data yang digabungkan" d={data} layerMap={layerMap} />
                  <Ringkasan judul="Ke data tujuan" d={target} layerMap={layerMap} />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => tolak(u)}
                    disabled={busyId !== null}
                    className="h-8 border-ink/40 bg-transparent text-ink hover:bg-ink/5"
                  >
                    {busyId === u.id && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Bukan data yang sama
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onReview(data, target)}
                    disabled={busyId !== null}
                    className="h-8 bg-qty hover:bg-qty/90 text-sheet"
                  >
                    Periksa &amp; gabungkan
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
