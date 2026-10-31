import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, fetchAllRows } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { buildLaporanKeterisian, namaFileLaporan } from "@/lib/laporan/docx-keterisian";
import { susunGroupLaporan, type BarisDaftarData, type LayerRingkas } from "@/lib/laporan/susun-data";

export const dynamic = "force-dynamic";

/** Template Word laporan; ikut dibundel lewat outputFileTracingIncludes di next.config.ts. */
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "laporan-keterisian.docx");

function gagal(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * GET /api/laporan-keterisian?tahun=2026&tanggal=2026-10-01
 * Unduh laporan "Tingkat Keterisian Data pada Portal JIGD" (.docx) untuk satu tahun.
 * Hanya untuk petugas yang sudah masuk.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return gagal("Konfigurasi Supabase belum diisi.", 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return gagal("Sesi login diperlukan untuk mengunduh laporan.", 401);

  const { searchParams } = new URL(request.url);
  const tahun = Number(searchParams.get("tahun"));
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return gagal("Tahun tidak valid.", 400);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(searchParams.get("tanggal") ?? "");
  const tanggal = match ? { year: +match[1], month: +match[2], day: +match[3] } : null;
  const valid =
    tanggal &&
    tanggal.month >= 1 &&
    tanggal.month <= 12 &&
    tanggal.day >= 1 &&
    tanggal.day <= new Date(Date.UTC(tanggal.year, tanggal.month, 0)).getUTCDate();
  if (!tanggal || !valid) return gagal("Tanggal tidak valid (format YYYY-MM-DD).", 400);

  const [daftar, layers] = await Promise.all([
    fetchAllRows<BarisDaftarData>((from, to) =>
      supabase
        .from("daftar_data")
        .select(
          "opd_id, nama_data, urutan, tahun_berlaku, status_keterisian, layer_utama_uuid, layer_pelengkap_uuids, created_at, master_opd:opd_id ( nama_opd )"
        )
        .contains("tahun_berlaku", [tahun])
        .order("urutan", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<LayerRingkas>((from, to) =>
      supabase
        .from("cache_layer_geoportal")
        .select("uuid, title, name")
        .order("id_dataset", { ascending: true })
        .range(from, to)
    ),
  ]);
  if (daftar.error || layers.error) {
    console.error("Laporan keterisian:", daftar.error ?? layers.error);
    return gagal("Gagal mengambil data dari database.", 502);
  }

  const groups = susunGroupLaporan(daftar.data, layers.data, tahun);
  if (groups.length === 0) return gagal(`Belum ada daftar data untuk tahun ${tahun}.`, 404);

  try {
    const template = new Uint8Array(await readFile(TEMPLATE_PATH));
    const docx = buildLaporanKeterisian(template, { tahun, tanggal, groups });
    const filename = namaFileLaporan(tanggal);

    return new NextResponse(Buffer.from(docx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Laporan keterisian:", err);
    return gagal(err instanceof Error ? err.message : "Gagal menyusun dokumen Word.", 500);
  }
}
