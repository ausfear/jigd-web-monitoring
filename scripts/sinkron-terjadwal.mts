// Sinkronisasi JIGD terjadwal (dijalankan GitHub Actions: .github/workflows/sinkron-jigd-terjadwal.yml).
//
// Memakai logika yang sama dengan tombol "Sinkronisasi JIGD" (lib/sync/sinkron-jigd.ts), tetapi
// menulis ke database dengan service role key karena tidak ada petugas yang login.
//
// Jalankan manual: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sinkron-terjadwal.mts
import { createClient } from "@supabase/supabase-js";
import { jalankanSinkronisasi } from "../lib/sync/sinkron-jigd.ts";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "::error::Secret SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY belum diisi " +
      "(GitHub repo > Settings > Secrets and variables > Actions)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const mulai = Date.now();
try {
  const hasil = await jalankanSinkronisasi(supabase, { sumber: "terjadwal" });
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);
  console.log(
    `Sinkronisasi selesai dalam ${detik} detik: ${hasil.synced_count} layer ` +
      `(${hasil.queried_layers} dibaca ulang dari GeoServer), ${hasil.opd_count} OPD, ` +
      `${hasil.new_opd_count} OPD baru, ${hasil.removed_count} layer usang dihapus.`
  );
  if (hasil.orphaned_data_count > 0) {
    console.log(
      `::warning::${hasil.orphaned_data_count} daftar data merujuk layer yang baru dihapus dari GeoNode; ` +
        "pilih layer penggantinya di halaman Verifikasi."
    );
  }
} catch (err) {
  console.error(`::error::Sinkronisasi gagal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
