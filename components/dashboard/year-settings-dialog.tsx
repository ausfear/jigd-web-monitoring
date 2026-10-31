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
        className="h-9 border-ink bg-transparent px-3 text-sm text-ink hover:bg-ink/5"
      >
        <CalendarCog className="h-4 w-4 mr-1.5" />
        Pengaturan Tahun
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setErrorMessage(null); setNewYear(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink flex items-center gap-2">
              <CalendarCog className="h-5 w-5 text-qty" />
              Pengaturan Tahun Aktif
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-2">
              Tahun aktif dipakai untuk pilihan tahun di dialog Verifikasi, filter tahun, halaman Overview, dan
              Produsen. Menonaktifkan tahun tidak menghapus data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {errorMessage && (
              <div className="p-3 bg-bound/10 border border-bound/40 text-bound rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-bound" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <span
                  key={y}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg bg-qty text-sheet text-sm font-semibold"
                >
                  {y}
                  <button
                    type="button"
                    onClick={() => handleRemove(y)}
                    disabled={busyYear !== null}
                    title={`Nonaktifkan tahun ${y}`}
                    className="rounded p-0.5 hover:bg-qty/90 disabled:opacity-50 cursor-pointer"
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
                className="h-9 text-sm bg-sheet border-rule"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busyYear !== null || !newYear.trim()}
                className="bg-qty hover:bg-qty/90 text-sheet text-sm font-medium shrink-0"
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
