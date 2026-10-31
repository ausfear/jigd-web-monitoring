"use client";

import React, { useState, useMemo } from "react";
import { GitMerge, AlertCircle, AlertTriangle, Loader2, Calendar, Building2, CheckCircle2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DaftarData, CacheLayerGeoportal } from "@/types/database";
import { supabase } from "@/lib/supabase";

interface MergeDataDialogProps {
  sourceRecord: DaftarData | null;
  isOpen: boolean;
  onClose: () => void;
  allRecords: DaftarData[];
  allCachedLayers: CacheLayerGeoportal[];
  onSuccess: () => void;
}

type MainChoice = "source" | "target";

const hasKugi = (r: DaftarData) => Boolean(r.kugi_id || r.kugi_nama_unsur);

const kugiNama = (r: DaftarData) => (r.master_kugi?.nama_unsur || r.kugi_nama_unsur || "").trim();

const kugiLabel = (r: DaftarData) => {
  const nama = kugiNama(r);
  if (!nama) return null;
  return r.master_kugi?.kode_unsur ? `${nama} (${r.master_kugi.kode_unsur})` : nama;
};

// Dua KUGI dianggap sama bila kode unsurnya sama, atau (jika salah satu belum berkode) nama unsurnya sama.
const isSameKugi = (a: DaftarData, b: DaftarData) =>
  a.kugi_id && b.kugi_id ? a.kugi_id === b.kugi_id : kugiNama(a).toLowerCase() === kugiNama(b).toLowerCase();

/**
 * Hitung isi data hasil merge. Nilai data utama dipakai lebih dulu; kolom yang kosong diisi dari
 * data lainnya. Layer utama data lain yang berbeda disimpan sebagai layer pelengkap agar tidak hilang.
 */
function buildMergedRecord(main: DaftarData, other: DaftarData, mergedYears: number[]) {
  const layerUtama = main.layer_utama_uuid || other.layer_utama_uuid || null;
  const layerPelengkap = Array.from(
    new Set(
      [
        ...(main.layer_pelengkap_uuids || []),
        ...(other.layer_pelengkap_uuids || []),
        other.layer_utama_uuid,
      ].filter((uuid): uuid is string => Boolean(uuid) && uuid !== layerUtama)
    )
  );
  const kugiSource = hasKugi(main) ? main : other;

  return {
    nama_data: main.nama_data,
    tag_bidang: main.tag_bidang || other.tag_bidang || null,
    urutan: main.urutan ?? other.urutan ?? null,
    tahun_berlaku: mergedYears,
    kugi_id: kugiSource.kugi_id || null,
    kugi_nama_unsur: kugiSource.kugi_nama_unsur || kugiSource.master_kugi?.nama_unsur || null,
    layer_utama_uuid: layerUtama,
    layer_pelengkap_uuids: layerPelengkap,
    status_keterisian: Boolean(layerUtama),
  };
}

export function MergeDataDialog({
  sourceRecord,
  isOpen,
  onClose,
  allRecords,
  allCachedLayers,
  onSuccess,
}: MergeDataDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [mainChoice, setMainChoice] = useState<MainChoice | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetAndClose = () => {
    setSelectedTargetId("");
    setMainChoice(null);
    setErrorMessage(null);
    onClose();
  };

  const layerMap = useMemo(() => {
    const map = new Map<string, CacheLayerGeoportal>();
    allCachedLayers.forEach((l) => {
      if (l.uuid) map.set(l.uuid, l);
    });
    return map;
  }, [allCachedLayers]);

  const layerLabel = (uuid: string | null | undefined) => {
    if (!uuid) return null;
    const layer = layerMap.get(uuid);
    return layer ? layer.title || layer.name : "Layer tidak ditemukan di cache";
  };

  // Available target candidates from the SAME OPD
  const targetCandidates = useMemo(() => {
    if (!sourceRecord) return [];
    return allRecords.filter(
      (r) => r.opd_id === sourceRecord.opd_id && r.id !== sourceRecord.id
    );
  }, [sourceRecord, allRecords]);

  const targetRecord = useMemo(() => {
    return targetCandidates.find((r) => r.id === selectedTargetId) || null;
  }, [targetCandidates, selectedTargetId]);

  // Merged tahun_berlaku array calculation (no duplicates, sorted)
  const mergedYears = useMemo(() => {
    if (!sourceRecord || !targetRecord) return [];
    const set = new Set<number>([
      ...(targetRecord.tahun_berlaku || []),
      ...(sourceRecord.tahun_berlaku || []),
    ]);
    return Array.from(set).sort((a, b) => a - b);
  }, [sourceRecord, targetRecord]);

  // Konflik: kedua data sudah berisi layer utama atau KUGI yang berbeda
  const conflict = useMemo(() => {
    if (!sourceRecord || !targetRecord) return { layer: false, kugi: false };
    return {
      layer: Boolean(
        sourceRecord.layer_utama_uuid &&
          targetRecord.layer_utama_uuid &&
          sourceRecord.layer_utama_uuid !== targetRecord.layer_utama_uuid
      ),
      kugi: hasKugi(sourceRecord) && hasKugi(targetRecord) && !isSameKugi(sourceRecord, targetRecord),
    };
  }, [sourceRecord, targetRecord]);
  const hasConflict = conflict.layer || conflict.kugi;

  // Tanpa konflik, data target menjadi data utama (perilaku semula)
  const effectiveMain: MainChoice | null = hasConflict ? mainChoice : "target";

  const mergedRecord = useMemo(() => {
    if (!sourceRecord || !targetRecord || !effectiveMain) return null;
    return effectiveMain === "source"
      ? buildMergedRecord(sourceRecord, targetRecord, mergedYears)
      : buildMergedRecord(targetRecord, sourceRecord, mergedYears);
  }, [sourceRecord, targetRecord, effectiveMain, mergedYears]);

  const mergedKugiLabel = useMemo(() => {
    if (!sourceRecord || !targetRecord || !mergedRecord) return null;
    const main = effectiveMain === "source" ? sourceRecord : targetRecord;
    const other = effectiveMain === "source" ? targetRecord : sourceRecord;
    return kugiLabel(hasKugi(main) ? main : other);
  }, [sourceRecord, targetRecord, mergedRecord, effectiveMain]);

  const handleMerge = async () => {
    if (!sourceRecord || !targetRecord) {
      setErrorMessage("Silakan pilih data target untuk digabungkan.");
      return;
    }
    if (!mergedRecord) {
      setErrorMessage("Silakan pilih data mana yang dijadikan data utama.");
      return;
    }

    try {
      setIsMerging(true);
      setErrorMessage(null);

      // 1. Simpan hasil gabungan ke baris target
      const { error: updateErr } = await supabase
        .from("daftar_data")
        .update(mergedRecord)
        .eq("id", targetRecord.id);

      if (updateErr) throw updateErr;

      // 2. Delete the source record
      const { error: deleteErr } = await supabase
        .from("daftar_data")
        .delete()
        .eq("id", sourceRecord.id);

      if (deleteErr) throw deleteErr;

      resetAndClose();
      onSuccess();
    } catch (err) {
      console.error("Merge error:", err);
      setErrorMessage((err as { message?: string })?.message || "Gagal menggabungkan data.");
    } finally {
      setIsMerging(false);
    }
  };

  if (!sourceRecord) return null;

  const conflictParts = [conflict.layer && "layer utama", conflict.kugi && "standar KUGI"].filter(Boolean).join(" dan ");

  const renderChoiceCard = (choice: MainChoice, record: DaftarData, label: string) => {
    const selected = mainChoice === choice;
    return (
      <button
        type="button"
        onClick={() => setMainChoice(choice)}
        className={`w-full text-left p-3 rounded-lg border text-xs space-y-1 transition-colors cursor-pointer ${
          selected
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-500/30"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200">{label}</span>
          {selected && <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
        </div>
        <div className="font-semibold text-slate-900 dark:text-slate-100">{record.nama_data}</div>
        <div className="text-slate-600 dark:text-slate-400">
          <strong>Layer utama:</strong> {layerLabel(record.layer_utama_uuid) || "-"}
        </div>
        <div className="text-slate-600 dark:text-slate-400">
          <strong>KUGI:</strong> {kugiLabel(record) || "-"}
        </div>
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetAndClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Merge dengan Data Lain (Satu OPD)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Gabungkan data ini ke entri target dari Perangkat Daerah yang sama. Tahun berlaku digabung, layer dan KUGI
            ikut dipindahkan, lalu data sumber dihapus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Source Record Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                Data Sumber (Akan Digabung &amp; Dihapus):
              </span>
              <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                ID: {sourceRecord.id.slice(0, 8)}...
              </Badge>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {sourceRecord.nama_data}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {sourceRecord.master_opd?.nama_opd || "OPD"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Tahun: {(sourceRecord.tahun_berlaku || []).join(", ") || "-"}
              </span>
            </div>
          </div>

          {/* Select Target Candidate */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Pilih Data Target (Akan Dipertahankan):</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                {targetCandidates.length} entri lain dari OPD ini
              </span>
            </label>

            {targetCandidates.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-200 text-center">
                Tidak ada entri data lain yang ditemukan dari Perangkat Daerah ini. Merge hanya dapat dilakukan antar data dari OPD yang sama.
              </div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={(e) => {
                  setSelectedTargetId(e.target.value);
                  setMainChoice(null);
                }}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">-- Pilih Data Target --</option>
                {targetCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.nama_data} (Tahun: {(candidate.tahun_berlaku || []).join(", ")})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Pilih data utama bila isi kedua data berbeda */}
          {targetRecord && hasConflict && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl space-y-2.5">
              <div className="text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Kedua data sudah berisi <strong>{conflictParts}</strong> yang berbeda. Pilih data yang dijadikan{" "}
                  <strong>data utama</strong>: nama data, layer utama, dan KUGI-nya yang dipakai pada hasil merge.
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {renderChoiceCard("source", sourceRecord, "Data Sumber")}
                {renderChoiceCard("target", targetRecord, "Data Target")}
              </div>
            </div>
          )}

          {/* Preview Merged Outcome */}
          {targetRecord && mergedRecord && (
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Hasil Penggabungan:
              </div>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <p>
                  <strong>Nama Data Akhir:</strong> {mergedRecord.nama_data}
                </p>
                <p className="flex items-center gap-1.5">
                  <strong>Tahun Berlaku Gabungan:</strong>
                  <span className="inline-flex gap-1">
                    {mergedYears.map((th) => (
                      <span
                        key={th}
                        className="bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 font-bold px-1.5 py-0.5 rounded"
                      >
                        {th}
                      </span>
                    ))}
                  </span>
                </p>
                <p>
                  <strong>Layer Utama:</strong> {layerLabel(mergedRecord.layer_utama_uuid) || "-"}
                  {mergedRecord.layer_pelengkap_uuids.length > 0 && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}(+ {mergedRecord.layer_pelengkap_uuids.length} layer pelengkap)
                    </span>
                  )}
                </p>
                <p>
                  <strong>Standar KUGI:</strong> {mergedKugiLabel || "-"}
                </p>
                {conflict.layer && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    Layer utama dari data yang tidak dipilih disimpan sebagai layer pelengkap, sehingga tidak hilang.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={resetAndClose}
            disabled={isMerging}
            className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleMerge}
            disabled={isMerging || !selectedTargetId || !mergedRecord}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Menggabungkan...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-1.5" />
                Konfirmasi Merge Data
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
