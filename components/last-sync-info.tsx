"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Event yang dikirim tombol Sinkronisasi JIGD setelah berhasil, agar keterangan ini dimuat ulang. */
export const EVENT_SINKRON_SELESAI = "jigd:sinkron-selesai";

/** Lewat dari batas ini, keterangan diberi tanda bahwa data mungkin sudah usang. */
const BATAS_USANG_JAM = 36;

type Info = { teks: string; sumber: string; usang: boolean; umur: string };

function umurTeks(menit: number): string {
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hari lalu`;
}

/** Ambil waktu sinkronisasi berhasil terakhir (di luar komponen: tidak menyentuh state React). */
async function muatInfo(): Promise<Info | null> {
  const { data, error } = await supabase.rpc("waktu_sinkron_terakhir");
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.selesai) return null; // fungsi belum dibuat atau belum pernah sinkron
  const waktu = new Date(row.selesai);
  const menit = Math.max(0, Math.round((Date.now() - waktu.getTime()) / 60000));
  return {
    teks:
      waktu.toLocaleString("id-ID", {
        timeZone: "Asia/Makassar",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WITA",
    sumber: row.sumber === "terjadwal" ? "otomatis" : "manual",
    usang: menit > BATAS_USANG_JAM * 60,
    umur: umurTeks(menit),
  };
}

/**
 * Keterangan kapan data layer terakhir disinkronkan dengan GeoNode JIGD, agar pembaca tahu
 * apakah angka di halaman ini mutakhir. Tidak tampil sama sekali bila belum ada catatan.
 */
export function LastSyncInfo({ className }: { className?: string }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let batal = false;
    const muat = () =>
      muatInfo()
        .then((i) => {
          if (!batal) setInfo(i);
        })
        .catch(() => {});
    muat();
    window.addEventListener(EVENT_SINKRON_SELESAI, muat);
    return () => {
      batal = true;
      window.removeEventListener(EVENT_SINKRON_SELESAI, muat);
    };
  }, []);

  if (!info) return null;

  return (
    <p className={cn("text-[13px] animate-reveal", info.usang ? "text-contour" : "text-ink-2", className)}>
      Data layer JIGD terakhir disinkronkan {info.teks} ({info.sumber}, {info.umur})
      {info.usang && ". Data mungkin sudah usang"}.
    </p>
  );
}
