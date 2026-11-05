"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/use-auth-user";
import { EVENT_SINKRON_SELESAI } from "@/components/last-sync-info";
import { cn } from "@/lib/utils";

type Pesan = { text: string; tone: "info" | "ok" | "error" };

/**
 * Tombol "Sinkronisasi JIGD": memperbarui cache layer dari GeoNode JIGD lewat /api/sync-jigd.
 * Hanya tampil untuk petugas yang sudah masuk (sinkronisasi menulis ke database). Hasilnya
 * tampil sebagai notifikasi di pojok kanan bawah, sehingga tata letak halaman tidak berubah.
 */
export function SyncButton({ onSynced, className }: { onSynced?: () => unknown; className?: string }) {
  const { user } = useAuthUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [pesan, setPesan] = useState<Pesan | null>(null);

  if (!user) return null;

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setPesan({ text: "Menghubungkan ke GeoNode JIGD…", tone: "info" });

      const res = await fetch("/api/sync-jigd", { method: "POST" });
      const result = await res.json();

      if (!result.success) {
        setPesan({ text: `Gagal sinkron: ${result.error || "terjadi kesalahan"}`, tone: "error" });
        return;
      }

      const text =
        `Berhasil sinkron: ${result.synced_count} layer, ${result.opd_count || 0} OPD terdata` +
        (result.new_opd_count ? ` (${result.new_opd_count} OPD baru)` : "") +
        (result.removed_count ? `, ${result.removed_count} layer usang dihapus dari cache.` : ".") +
        (result.orphaned_data_count
          ? ` ${result.orphaned_data_count} daftar data merujuk layer yang dihapus; pilih penggantinya lewat Verifikasi.`
          : "");
      setPesan({ text, tone: "ok" });
      window.dispatchEvent(new Event(EVENT_SINKRON_SELESAI));
      await onSynced?.();
      // Pesan yang meminta tindakan tetap tampil sampai ditutup
      if (!result.orphaned_data_count) {
        setTimeout(() => setPesan((p) => (p?.text === text ? null : p)), 6000);
      }
    } catch (err) {
      console.error("Sync trigger error:", err);
      setPesan({ text: "Gagal menjalankan sinkronisasi. Periksa koneksi lalu coba lagi.", tone: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isSyncing}
        className={cn("h-9 border-ink bg-transparent px-3 text-sm text-ink hover:bg-ink/5 animate-reveal", className)}
      >
        <RefreshCw className={cn("h-4 w-4 mr-1.5", isSyncing && "animate-spin")} />
        {isSyncing ? "Menyinkronkan…" : "Sinkronisasi JIGD"}
      </Button>

      {pesan &&
        createPortal(
          <div
            role={pesan.tone === "error" ? "alert" : "status"}
            className={cn(
              "fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-start gap-3 border border-l-4 bg-sheet p-3.5 text-sm text-ink shadow-[4px_4px_0_0_color-mix(in_srgb,var(--ink)_14%,transparent)] sm:max-w-sm animate-reveal",
              pesan.tone === "error" ? "border-bound" : "border-qty"
            )}
          >
            <span className="flex-1">{pesan.text}</span>
            {!isSyncing && (
              <button
                type="button"
                onClick={() => setPesan(null)}
                aria-label="Tutup pesan"
                className="p-0.5 text-ink-2 hover:text-ink hover:bg-ink/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
