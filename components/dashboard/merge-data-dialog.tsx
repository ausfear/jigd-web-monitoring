"use client";

import React, { useState, useMemo } from "react";
import { GitMerge, AlertCircle, Loader2, Calendar, Building2, CheckCircle2, Trash2 } from "lucide-react";
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
import { DaftarData } from "@/types/database";
import { supabase } from "@/lib/supabase";

interface MergeDataDialogProps {
  sourceRecord: DaftarData | null;
  isOpen: boolean;
  onClose: () => void;
  allRecords: DaftarData[];
  onSuccess: () => void;
}

export function MergeDataDialog({
  sourceRecord,
  isOpen,
  onClose,
  allRecords,
  onSuccess,
}: MergeDataDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [isMerging, setIsMerging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleMerge = async () => {
    if (!sourceRecord || !targetRecord) {
      setErrorMessage("Silakan pilih data target untuk digabungkan.");
      return;
    }

    try {
      setIsMerging(true);
      setErrorMessage(null);

      // 1. Update target record with merged years
      const { error: updateErr } = await supabase
        .from("daftar_data")
        .update({
          tahun_berlaku: mergedYears,
        })
        .eq("id", targetRecord.id);

      if (updateErr) throw updateErr;

      // 2. Delete the source record
      const { error: deleteErr } = await supabase
        .from("daftar_data")
        .delete()
        .eq("id", sourceRecord.id);

      if (deleteErr) throw deleteErr;

      setSelectedTargetId("");
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Merge error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menggabungkan data.");
    } finally {
      setIsMerging(false);
    }
  };

  if (!sourceRecord) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setSelectedTargetId(""); onClose(); } }}>
      <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Merge dengan Data Lain (Satu OPD)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Gabungkan riwayat tahun data ini ke entri target dari Perangkat Daerah yang sama. Data target akan dipertahankan dan data sumber akan dihapus.
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
                onChange={(e) => setSelectedTargetId(e.target.value)}
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

          {/* Preview Merged Outcome */}
          {targetRecord && (
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2 text-xs">
              <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Hasil Penggabungan:
              </div>
              <div className="space-y-1 text-slate-700 dark:text-slate-300">
                <p>
                  <strong>Nama Data Akhir:</strong> {targetRecord.nama_data}
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Standar KUGI dan ID Layer dari data target akan tetap tersimpan.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setSelectedTargetId(""); onClose(); }}
            disabled={isMerging}
            className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleMerge}
            disabled={isMerging || !selectedTargetId}
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
