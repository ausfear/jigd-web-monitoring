"use client";

import React, { useState } from "react";
import { PlusCircle, Loader2, Database, Building2, Calendar, FileCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDialogState } from "@/lib/use-dialog-state";
import { Input } from "@/components/ui/input";
import { MasterOpd } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ManualAddDialogProps {
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

export function ManualAddDialog({ opdList, defaultYear, onSuccess, size = "sm", className, open, onOpenChange }: ManualAddDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [namaData, setNamaData] = useState("");
  const [tahun, setTahun] = useState<string>(String(defaultYear));
  const [opdId, setOpdId] = useState<string>("");

  const resetForm = () => {
    setNamaData("");
    setTahun(String(defaultYear));
    setOpdId("");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!namaData.trim()) {
      setErrorMessage("Nama Data Geospasial wajib diisi.");
      return;
    }

    if (!opdId) {
      setErrorMessage("Silakan pilih Perangkat Daerah (OPD).");
      return;
    }

    const parsedTahun = parseInt(tahun.trim(), 10);
    if (isNaN(parsedTahun) || parsedTahun < 2000 || parsedTahun > 2100) {
      setErrorMessage("Tahun berlaku harus berupa tahun yang valid (contoh: 2026).");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.from("daftar_data").insert({
        nama_data: namaData.trim(),
        opd_id: opdId,
        tahun_berlaku: [parsedTahun],
        status_keterisian: false,
        layer_pelengkap_uuids: [],
      });

      if (error) {
        throw error;
      }

      resetForm();
      setIsOpen(false);
      onSuccess();
    } catch (err) {
      console.error("Error adding manual record:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal menambahkan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const { isOpen, setIsOpen, controlled } = useDialogState(open, onOpenChange, () => setTahun(String(defaultYear)));

  return (
    <>
      {!controlled && (
        <Button
          size={size}
          onClick={() => setIsOpen(true)}
          className={cn(
            "h-9 bg-qty hover:bg-qty/90 px-3 text-sm text-sheet",
            className
          )}
        >
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Tambah Data
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
            <Database className="h-5 w-5 text-qty" />
            Tambah Data Geospasial Baru
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Tambahkan entri data geospasial tematik ke daftar pemantauan JIGD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 bg-bound/10 border border-bound/40 text-bound rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* 1. Nama Data Geospasial */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-qty" />
              Nama Data Geospasial <span className="text-bound">*</span>
            </label>
            <Input
              value={namaData}
              onChange={(e) => setNamaData(e.target.value)}
              placeholder="Contoh: Peta Batas Wilayah Administrasi..."
              className="text-sm bg-sheet border-rule focus-visible:ring-qty/30"
              required
            />
          </div>

          {/* 2. Perangkat Daerah (OPD) */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-qty" />
              Perangkat Daerah (OPD) <span className="text-bound">*</span>
            </label>
            <select
              value={opdId}
              onChange={(e) => setOpdId(e.target.value)}
              className="w-full h-10 rounded-lg border border-rule bg-sheet px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-qty focus:ring-2 focus:ring-qty/30"
              required
            >
              <option value="">-- Pilih Perangkat Daerah --</option>
              {opdList.map((opd) => (
                <option key={opd.id} value={opd.id}>
                  {opd.nama_opd} {opd.username_jigd ? `(${opd.username_jigd})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Tahun Berlaku */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-ink flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-qty" />
              Tahun Berlaku <span className="text-bound">*</span>
            </label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              placeholder={String(defaultYear)}
              className="text-sm bg-sheet border-rule focus-visible:ring-qty/30"
              required
            />
            <p className="text-[13px] text-ink-2">
              Tahun penganggaran atau keberlakuan data geospasial.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="border-rule"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-qty hover:bg-qty/90 text-sheet font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Data"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}
