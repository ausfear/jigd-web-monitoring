# JIGD Web Monitoring

Aplikasi web untuk memantau **keterisian Daftar Data Geospasial** pada portal
[JIGD Kalimantan Timur](https://jigd.kaltimprov.go.id) (Jaringan Informasi Geospasial Daerah).

Setiap baris daftar data, yaitu data yang wajib disediakan oleh sebuah OPD pada tahun tertentu, dicocokkan dengan layer yang
sudah diunggah ke GeoNode JIGD. Baris juga bisa ditandai dengan unsur
**KUGI** (Katalog Unsur Geografi Indonesia).

## Halaman

| Halaman | Akses | Isi |
|---|---|---|
| `/` Beranda | Publik | Ringkasan dan tautan ke halaman lain |
| `/overview` | Publik | Statistik layer (geometri, SRID) dan perbandingan keterisian antar tahun |
| `/produsen` | Publik | Rekap keterisian dan pemetaan KUGI per OPD |
| `/datasets` | Publik | Katalog seluruh layer GeoNode yang tersimpan di cache. Tanda ceklis di ujung judul menandai layer yang sudah dipakai di daftar data (filter: Sudah / Belum dipakai) |
| `/dashboard` | Login | Kelola daftar data: tambah manual atau CSV, verifikasi layer dan KUGI, merge, pengaturan tahun, sinkronisasi GeoNode, unduh laporan Word |

## Teknologi

- Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind CSS 4, komponen shadcn/Base UI, Recharts
- Supabase: PostgreSQL, Auth, Row Level Security
- GeoNode API JIGD (`/api/datasets/`, `/api/owners/`) dan GeoServer WFS `DescribeFeatureType`, untuk tipe geometri dan jumlah atribut

## Struktur data (Supabase)

| Tabel | Isi |
|---|---|
| `master_opd` | Daftar OPD. `username_jigd` = username pemilik layer di GeoNode |
| `master_kugi` | Katalog unsur KUGI (`nama_unsur`, `kode_unsur`, …) |
| `cache_layer_geoportal` | Cache layer GeoNode, diperbarui lewat tombol **Sinkronisasi JIGD** |
| `daftar_data` | Daftar data per OPD: `tahun_berlaku`, KUGI, `layer_utama_uuid`, `layer_pelengkap_uuids`, `status_keterisian`, `urutan` |
| `pengaturan_tahun` | Tahun aktif yang muncul di pilihan tahun aplikasi |

- **Status keterisian**: *Terisi* jika baris punya Layer Utama.
- **Urutan tampil**: kolom `urutan` mengikuti nomor baris pada sheet Daftar Data di file Excel. Baris tanpa `urutan`, misalnya data baru, tampil paling akhir.

## Menjalankan di komputer lokal

1. Install dependency:
   ```bash
   npm install
   ```
2. Buat file `.env.local` di root proyek:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   Kedua nilai ada di Supabase → Project Settings → API.
3. Jalankan server pengembangan:
   ```bash
   npm run dev
   ```
   Buka <http://localhost:3000>.
4. Sebelum commit, cek kode:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```

## Menyiapkan database baru

Jalankan file berikut di **Supabase → SQL Editor**: klik *New query*, tempel isi file, lalu klik *Run*.

1. `database_schema.sql`: semua tabel, index, policy RLS, dan trigger yang menyamakan status Terisi dengan Layer Utama.
2. File di folder `migrations/` sesuai urutan tanggal. Semua file aman dijalankan ulang.

Akun login dashboard dibuat lewat **Supabase → Authentication → Users → Add user**.

Policy RLS:
- **Baca**: publik, karena halaman Overview, Produsen, dan Datasets bisa dibuka tanpa login.
- **Tulis** (tambah, ubah, hapus): hanya untuk user yang login.

## Menu Pengaturan di Dashboard

Tombol **Sinkronisasi JIGD** ada di halaman Overview, Produsen, Datasets, dan Verifikasi (hanya tampil setelah login). Semua aksi lain di Dashboard ada di menu **Pengaturan**:

| Menu | Fungsi |
|---|---|
| Tambah data, Unggah CSV | Menambah daftar data |
| Pilih beberapa data | Mode pilih (bulk action): centang beberapa daftar data, lalu ubah sekaligus tag/bidang, layer utama, layer pelengkap, tahun berlaku, atau KUGI |
| Atur urutan | Mengurutkan OPD, lalu daftar data di dalam tiap OPD (seret atau tombol panah). Urutan dipakai tabel, laporan Word, dan halaman publik; nomornya tidak ditampilkan |
| Usulan merge | Pasangan daftar data yang kemungkinan sama (mis. hasil impor tahun lain). Gabungkan lewat dialog Merge, atau tandai "Bukan data yang sama" |
| Unduh laporan Word | Lihat bagian berikut |
| Riwayat perubahan | Setiap tambah, ubah, dan hapus daftar data beserta petugasnya, dicatat otomatis oleh trigger database |
| Pengaturan tahun | Tahun aktif |

Di dialog Verifikasi, selama Layer Utama belum dipilih, muncul **saran layer** milik OPD tersebut yang judul atau namanya mirip dengan nama data (`lib/layer-suggest.ts`), lengkap dengan keterangan bila layer itu sudah dipakai daftar data lain.

## Laporan Word

Menu **Unduh laporan Word** di Dashboard menghasilkan dokumen "Tingkat Keterisian Data pada Portal JIGD" (.docx) untuk tahun dan tanggal update yang dipilih. Dokumen disusun di server (`app/api/laporan-keterisian`) dan hanya bisa diunduh setelah login.

- **Format** diambil dari `templates/laporan-keterisian.docx`. Baris tabel dari file itu disalin apa adanya, lalu hanya data, warna status, tahun di judul kolom, dan kedua tanggal yang diganti. Isian SRIKANDI (`${nomor_naskah}`, `${ttd_pengirim}`, `${nama_pengirim}`, `${nip_pengirim}`) dibiarkan.
- **Isi tabel**: daftar data tahun terpilih menurut urutan sheet Daftar Data, dikelompokkan per OPD (nama dari `master_opd`). Kolom layer berisi judul layer utama lalu layer pelengkap.
- **Mengganti format**: timpa `templates/laporan-keterisian.docx` dengan laporan versi baru (misalnya kop atau penandatangan berubah). Strukturnya harus tetap sama: tabel utama enam kolom dengan sel OPD digabung, tabel rekap berbaris "Terisi" dan "Tidak Terisi", serta baris "Update: …" dan "Samarinda, …".

## Alur kerja tahunan

1. **Tambahkan tahun baru** lewat Dashboard → Pengaturan → **Pengaturan tahun**. Contoh: tambahkan 2027 saat daftar data 2027 terbit. Tahun lama yang tidak lagi dipantau bisa dinonaktifkan; datanya tidak terhapus.
2. **Sinkronisasi JIGD** (tombol di halaman mana pun selain Beranda). Langkah ini:
   - memperbarui cache layer;
   - menghapus layer yang sudah dihapus dari GeoNode;
   - menambahkan OPD baru. Nama OPD yang sudah ada tidak diubah.
3. **Masukkan daftar data** lewat Pengaturan → **Unggah CSV** atau **Tambah data**, lalu rapikan posisinya lewat **Atur urutan**.
4. **Verifikasi** setiap baris: pilih Layer Utama, Layer Pelengkap, dan KUGI.
5. Jika ada baris ganda, gunakan **Merge dengan Data Lain** (menu aksi baris) atau tinjau **Usulan merge**.
   - Tahun berlaku kedua baris digabung.
   - Jika kedua baris sudah punya layer atau KUGI yang berbeda, aplikasi meminta Anda memilih data utama.
