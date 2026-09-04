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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasterOpd, MasterKugi } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ManualAddDialogProps {
  opdList: MasterOpd[];
  kugiList?: MasterKugi[];
  onSuccess: () => void;
  size?: "default" | "sm";
  className?: string;
}

export function ManualAddDialog({ opdList, kugiList, onSuccess, size = "sm", className }: ManualAddDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [namaData, setNamaData] = useState("");
  const [tahun, setTahun] = useState<string>("2026");
  const [opdId, setOpdId] = useState<string>("");

  const resetForm = () => {
    setNamaData("");
    setTahun("2026");
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

  return (
    <>
      <Button
        size={size}
        onClick={() => setIsOpen(true)}
        className={cn(
          "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs text-xs font-medium",
          className
        )}
      >
        <PlusCircle className="h-4 w-4 mr-1.5" />
        Tambah Data
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Tambah Data Geospasial Baru
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Tambahkan entri data geospasial tematik ke daftar pemantauan JIGD.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs">
              {errorMessage}
            </div>
          )}

          {/* 1. Nama Data Geospasial */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Nama Data Geospasial <span className="text-rose-500">*</span>
            </label>
            <Input
              value={namaData}
              onChange={(e) => setNamaData(e.target.value)}
              placeholder="Contoh: Peta Batas Wilayah Administrasi..."
              className="text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
              required
            />
          </div>

          {/* 2. Perangkat Daerah (OPD) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Perangkat Daerah (OPD) <span className="text-rose-500">*</span>
            </label>
            <select
              value={opdId}
              onChange={(e) => setOpdId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Tahun Berlaku <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              placeholder="2026"
              className="text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 dark:text-slate-100 focus-visible:ring-blue-500"
              required
            />
            <p className="text-[11px] text-slate-400">
              Tahun penganggaran atau keberlakuan data geospasial.
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="border-slate-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
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
