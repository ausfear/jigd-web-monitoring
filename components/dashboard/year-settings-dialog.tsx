"use client";

import React, { useState } from "react";
import { CalendarCog, Loader2, Plus, X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface YearSettingsDialogProps {
  years: number[];
  onSuccess: () => void;
}

/**
 * Pengaturan tahun aktif (tabel pengaturan_tahun). Tahun aktif menentukan pilihan tahun
 * di dialog Verifikasi, filter, Overview, dan Produsen. Menghapus tahun di sini tidak
 * menghapus data apa pun di daftar_data.
 */
export function YearSettingsDialog({ years, onSuccess }: YearSettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const describeError = (message: string) =>
    message.includes("pengaturan_tahun")
      ? "Tabel pengaturan_tahun belum ada. Jalankan migrations/2026-10-31_pengaturan_tahun.sql di Supabase SQL Editor."
      : message;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const tahun = parseInt(newYear.trim(), 10);
    if (isNaN(tahun) || tahun < 2000 || tahun > 2100) {
      setErrorMessage("Masukkan tahun yang valid (contoh: 2027).");
      return;
    }
    if (years.includes(tahun)) {
      setErrorMessage(`Tahun ${tahun} sudah aktif.`);
      return;
    }

    try {
      setBusyYear(tahun);
      const { error } = await supabase.from("pengaturan_tahun").insert({ tahun });
      if (error) throw error;
      setNewYear("");
      onSuccess();
    } catch (err) {
      setErrorMessage(describeError((err as { message?: string })?.message || String(err)));
    } finally {
      setBusyYear(null);
    }
  };

  const handleRemove = async (tahun: number) => {
    if (years.length <= 1) {
      setErrorMessage("Minimal harus ada satu tahun aktif.");
      return;
    }
    if (!window.confirm(`Nonaktifkan tahun ${tahun}? Data dengan tahun ${tahun} tidak akan dihapus.`)) return;

    try {
      setErrorMessage(null);
      setBusyYear(tahun);
      const { error } = await supabase.from("pengaturan_tahun").delete().eq("tahun", tahun);
      if (error) throw error;
      onSuccess();
    } catch (err) {
      setErrorMessage(describeError((err as { message?: string })?.message || String(err)));
    } finally {
      setBusyYear(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs text-xs font-medium"
      >
        <CalendarCog className="h-4 w-4 mr-1.5 text-blue-600 dark:text-blue-400" />
        Pengaturan Tahun
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setErrorMessage(null); setNewYear(""); } }}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-border dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CalendarCog className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Pengaturan Tahun Aktif
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Tahun aktif dipakai untuk pilihan tahun di dialog Verifikasi, filter tahun, halaman Overview, dan
              Produsen. Menonaktifkan tahun tidak menghapus data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <span
                  key={y}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  {y}
                  <button
                    type="button"
                    onClick={() => handleRemove(y)}
                    disabled={busyYear !== null}
                    title={`Nonaktifkan tahun ${y}`}
                    className="rounded p-0.5 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    {busyYear === y ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Contoh: 2027"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busyYear !== null || !newYear.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shrink-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tambah Tahun
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
