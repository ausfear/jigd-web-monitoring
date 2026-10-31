-- ==============================================================================
-- Migration: Kolom urutan pada daftar_data
-- Tujuan : Menampilkan daftar data sesuai urutan nomor pada sheet
--          "Daftar Data 2026" (file Keterisian JIGD 2026.xlsx).
-- Cara   : Jalankan seluruh isi file ini di Supabase Dashboard > SQL Editor.
--          Aman dijalankan ulang (idempotent).
-- ==============================================================================

-- 1. Tambah kolom urutan (NULL = data baru, ditampilkan paling akhir)
ALTER TABLE daftar_data
ADD COLUMN IF NOT EXISTS urutan INTEGER;

CREATE INDEX IF NOT EXISTS idx_daftar_data_urutan ON daftar_data(urutan);

-- 2. Isi urutan berdasarkan nomor baris pada sheet "Daftar Data 2026"
--    (urutan global: OPD sesuai urutan Excel, lalu nomor data di dalam OPD)
UPDATE daftar_data AS d
SET urutan = v.urutan
FROM (VALUES
    ('8217480b-8d4a-4c9b-8777-87c2904be2fa'::uuid, 1),  -- Excel baris 5: Peta Batas Administrasi Kabupaten/Kota
    ('840b31de-5cbd-45fe-8121-9781931de612'::uuid, 2),  -- Excel baris 6: Peta Pilar Batas Kabupaten/Kota
    ('6d6ceafa-4714-499e-8eca-74c70cc41329'::uuid, 3),  -- Excel baris 7: Garis batas kabupaten
    ('3dc7fd1c-409a-4f2c-85da-cec4abe9bd26'::uuid, 4),  -- Excel baris 8: Peta Batas Wilayah Administrasi Kewenangan Pengelolaan Sumber Daya Ala
    ('f68569fb-d1cd-45e4-b998-52cd116de65f'::uuid, 5),  -- Excel baris 9: Peta kabupaten dan kota yang mempunyai konflik batas wilayah
    ('5a2f59e7-bfaf-463e-a10a-742465cfa074'::uuid, 6),  -- Excel baris 10: Peta Hasil Kajian Peri-urban IKN
    ('48756ff9-f27a-4c35-9b64-77885af22c76'::uuid, 7),  -- Excel baris 11: Peta Hasil Kajian Wilayah Penyangga IKN
    ('94b8300f-0aa1-48b8-b3f2-19c71a122502'::uuid, 8),  -- Excel baris 12: Peta Aset Tanah dan Gedung Milik Pemprov. Kaltim (titik)
    ('3e659128-af23-4805-80ed-288423fc7bd9'::uuid, 9),  -- Excel baris 13: Peta Aset Tanah dan Gedung Milik Pemprov. Kaltim (poligon)
    ('d2992651-e7ac-4ddd-9430-0d76a9291110'::uuid, 10),  -- Excel baris 14: Peta Sebaran Desa Tangguh Bencana
    ('21ba8a6a-4334-4daf-a628-0f92f2802fa7'::uuid, 11),  -- Excel baris 15: Peta Sebaran Tim Reaksi Cepat
    ('4bf6f1b7-09a5-4c7c-8413-bb54e2709c94'::uuid, 12),  -- Excel baris 16: Peta Risiko Bencana Banjir
    ('58731e0a-c0f9-422e-beac-d26531ee5bea'::uuid, 13),  -- Excel baris 17: Peta Risiko Bencana Tsunami
    ('cb415fdc-7c1b-4661-bb14-63fa56f51488'::uuid, 14),  -- Excel baris 18: Peta Risiko Bencana Tanah Longsor
    ('05cf9e58-7a86-4e2a-8f41-bd8f25ec5872'::uuid, 15),  -- Excel baris 19: Peta Risiko Bencana Kekeringan
    ('b19c9dda-87a4-4a75-8aa0-fa5584d00e8c'::uuid, 16),  -- Excel baris 20: Peta Risiko Bencana Letusan Gunung Api
    ('723afd53-aece-4d14-9812-f6fbbb1d8f9b'::uuid, 17),  -- Excel baris 21: Peta Risiko Bencana Gempabumi
    ('543e0dee-e573-44da-acce-3e089e0332ed'::uuid, 18),  -- Excel baris 22: Peta Risiko Bencana Gelombang Ekstrim dan Abrasi
    ('42ebd266-6472-4960-81d6-7e68d9456d2b'::uuid, 19),  -- Excel baris 23: Peta Risiko Bencana Cuaca Ekstrim skala
    ('e80bb2ba-3ca2-40bd-bff1-1d27a01a1c90'::uuid, 20),  -- Excel baris 24: Peta Risiko Bencana Banjir Bandang skala
    ('6ff83339-798e-446f-ab6e-e3c54235ac4d'::uuid, 21),  -- Excel baris 25: Peta Risiko Bencana Kebakaran Hutan dan Lahan
    ('19a4279f-8bec-4e37-bfab-4c078575d269'::uuid, 22),  -- Excel baris 26: Peta Risiko Bencana Likuefaksi
    ('de1e66f2-a2e8-4ff7-8e04-9c8728e2e007'::uuid, 23),  -- Excel baris 27: Peta Sebaran Hotspot Pada Lahan
    ('7d486277-36c4-4dfa-b82f-f44601661b69'::uuid, 24),  -- Excel baris 28: Peta Sebaran UPTD PPRD dan SAMSAT
    ('116c6ee2-eb4f-4b04-923f-22298d6ce55d'::uuid, 25),  -- Excel baris 29: Peta Sebaran Mitra Kerja Sama SAMSAT
    ('764ce8ba-5761-4caa-998d-cb1e0ac55a4a'::uuid, 26),  -- Excel baris 30: Peta Sebaran Pajak Air Permukaan
    ('1bb1f379-e060-4381-a20c-f0cbfd7de991'::uuid, 27),  -- Excel baris 31: Peta Pabrik kelapa sawit
    ('35a20de9-3643-4134-9ba4-c179a42025d9'::uuid, 28),  -- Excel baris 32: Peta Instalasi Pengolahan Biogas dari POME
    ('2df9af83-e199-48d5-8aca-f7a32dc7fef2'::uuid, 29),  -- Excel baris 33: Peta Masterplan Kawasan Pertanian 2018-2023
    ('8b8adb8d-d9dc-46c6-ae62-03c6472d374d'::uuid, 30),  -- Excel baris 34: Peta Roadmap Pembangunan Pertanian Tahun 2025-2035
    ('f9a3e7e7-9003-4f3b-938a-ceff733b7390'::uuid, 31),  -- Excel baris 35: Peta Lahan Pertanian Tanaman Pangan
    ('7c916a44-552a-4db3-b22f-99a0ac3f1e99'::uuid, 32),  -- Excel baris 36: Peta Lahan Pertanian Hortikultura
    ('41d3ba05-183b-452d-b241-719dba1f1207'::uuid, 33),  -- Excel baris 37: Peta Kesesuaian Lahan Pertanian
    ('0e2080a7-7320-4120-816d-3a81ce15639d'::uuid, 34),  -- Excel baris 38: Peta Ketahanan dan Kerentanan Pangan (Food Security and Vulnerability 
    ('6e55c3d7-3cfe-4798-ac10-776454ee4297'::uuid, 35),  -- Excel baris 39: Peta Grand Desain Tanaman Pisang
    ('819915de-61e6-45d9-976b-2783e8476616'::uuid, 36),  -- Excel baris 40: Peta Lahan Pertanian Pangan Berkelanjutan (LP2B)
    ('b6925555-0157-4789-aae5-6c1b5a3d9dda'::uuid, 37),  -- Excel baris 41: Pulau (Titik)
    ('f6f6805b-170f-43c5-9886-f8d28b57a08a'::uuid, 38),  -- Excel baris 42: Peta Rencana Tata Ruang Laut
    ('31840195-3952-4b38-b2d4-654a3ee559a4'::uuid, 39),  -- Excel baris 43: Peta Wilayah Kerja dan Pengoperasian Pelabuhan Perikanan (WKOPP)
    ('a312da19-fe3b-45b8-a246-539d8e224980'::uuid, 40),  -- Excel baris 44: Peta Laut
    ('e3c486c6-d231-4750-b469-02f8c4b3ab9f'::uuid, 41),  -- Excel baris 45: Peta Wilayah Penangkapan 0-12 mil laut
    ('73db5fb5-e4cf-46ee-9760-0766ff382fca'::uuid, 42),  -- Excel baris 46: Peta Perairan Umum
    ('01ae1de3-238b-4ceb-a537-246684892806'::uuid, 43),  -- Excel baris 47: Peta Sebaran Perikanan Budidaya 1:50.000
    ('cda1acae-1292-4d6b-862c-8e8ad5820a5c'::uuid, 44),  -- Excel baris 48: Peta Rencana Zonasi Kawasan Strategis Nasional Tertentu Non PPKT 1:50.
    ('e47e6ca0-5b48-45f7-ba21-b1e3600fb5dc'::uuid, 45),  -- Excel baris 49: Peta Terumbu Karang skala 1:50.000
    ('90145bfe-15e8-44c0-a24b-79ec51b367d6'::uuid, 46),  -- Excel baris 50: Peta Lokasi Pelabuhan Perikanan skala 1:50.000
    ('dd129e33-d136-445d-aff2-ab650e37cec6'::uuid, 47),  -- Excel baris 51: Peta Zonasi Kawasan Konservasi Perairan skala 1:50.000
    ('721a37cb-9f32-442c-abbd-12fa992cc9c8'::uuid, 48),  -- Excel baris 52: Peta Padang Lamun skala 1:50.000
    ('651166c3-d1d2-4d6c-90ec-3d32da2371e6'::uuid, 49),  -- Excel baris 53: Peta Jalur Penangkapan dan Penempatan Alat Penangkapan Ikan skala 1:5.
    ('3d19d779-21b7-4699-b533-4471c6491ea7'::uuid, 50),  -- Excel baris 54: Peta Daerah Penangkapan Ikan di Jalur Penangkapan Ikan skala 1:50.000
    ('c7ea3d4d-7b8f-411f-a585-71b3aa956d22'::uuid, 51),  -- Excel baris 55: Peta Akresi dan Abrasi Skala 1:50.000
    ('b47f8fc9-20c0-470c-b1b1-40972b004c54'::uuid, 52),  -- Excel baris 56: Peta Pulau-Pulau Kecil Terluar skala 1:50.000
    ('facc5ac7-8bb3-4e7b-a976-c50aaf7db5f4'::uuid, 53),  -- Excel baris 57: Peta Rencana Zonasi Kawasan Antarwilayah 0 - 12 mil laut skala 1:50.00
    ('4d24a93e-4afe-4708-b8a1-0ef4f38fa4d4'::uuid, 54),  -- Excel baris 58: Peta Sebaran Gudang Beku Komoditas Ikan skala 1:50.000
    ('5d09cd24-f4b8-4c05-b25a-d35b32c335a2'::uuid, 55),  -- Excel baris 59: Peta Alur Migrasi Biota Laut
    ('deef8fae-5a25-4a59-8ad0-6e9e568fe05e'::uuid, 56),  -- Excel baris 60: Peta Lokasi Kelompok Tani Peternakan Kalimantan Timur
    ('233351c5-89b3-4f47-b728-ad66c61014a3'::uuid, 57),  -- Excel baris 61: Peta Pengembangan Desa Korporasi Ternak
    ('b68d42ab-9cc0-487f-876a-d62d0aa431d1'::uuid, 58),  -- Excel baris 62: Peta Sebaran Rumah Potong Hewan
    ('9ea1bf99-9255-4e63-9cc9-cb89ff6c3f6c'::uuid, 59),  -- Excel baris 63: Peta Sebaran Miniranch
    ('833356cc-6366-49c1-ad35-637a5d87961f'::uuid, 60),  -- Excel baris 64: Peta Sebaran Irigasi Perpompaan untuk Peternakan
    ('6b0fcb53-ecd0-4a71-9b33-529093f2576e'::uuid, 61),  -- Excel baris 65: Peta Sebaran Penyakit Hewan Menular Strategis (PHMS)
    ('bf035e93-cafe-4e1c-90a4-2702f79cc497'::uuid, 62),  -- Excel baris 66: Peta Lahan Peternakan skala 1:50.000
    ('aab60e09-9f91-4860-8ff1-25a111253b5d'::uuid, 63),  -- Excel baris 67: Peta Fungsi Ekosistem Gambut (FEG) skala 1:50.000
    ('5bd602ad-b4c2-48c6-8c99-70f897f6f43a'::uuid, 64),  -- Excel baris 68: Peta Kesatuan Hidrologis Gambut (KHG) skala 1:50.000
    ('8074ad39-00d9-45a2-8f03-4a5ae7b1e43e'::uuid, 65),  -- Excel baris 69: Peta Daya Dukung dan Daya Tampung Lingkungan Hidup (DDDTLH) skala 1:25
    ('3fc3b55b-49b9-4235-a31e-4a432ecb430d'::uuid, 66),  -- Excel baris 70: Peta Pemantauan Sampah Laut skala 1:250.000
    ('82eff875-b74e-4de3-8d61-9f5d93abe4c0'::uuid, 67),  -- Excel baris 71: Peta Status Mutu Air skala 1:250.000
    ('b1f6c1fb-768d-4915-b3e7-b698c7d7d810'::uuid, 68),  -- Excel baris 72: Peta Indeks Kualitas Air Laut skala 1:250.000
    ('07a0d0c7-ba68-4aa4-aa1d-2af04996c388'::uuid, 69),  -- Excel baris 73: Peta Indeks Kualitas Udara skala 1:250.000
    ('16dc92f5-83e3-4c5a-9402-4cb38536c204'::uuid, 70),  -- Excel baris 74: Peta Sebaran Pengelolaan Sampah skala 1:50.000
    ('21e7db79-5369-4111-85cd-9a6a079a1092'::uuid, 71),  -- Excel baris 75: Persetujuan Lingkungan Hidup dan Persetujuan Pemerintah (poligon)
    ('ce22976e-3947-4321-b8ac-d1bfd18bdcce'::uuid, 72),  -- Excel baris 76: Daya dukung daya tampung lingkungan hidup
    ('421ee567-165e-4796-8edf-f7e92ac635dd'::uuid, 73),  -- Excel baris 77: Lokasi pengambilan sampel pemantauan kualitas lingkungan hidup (kualit
    ('e0e3346f-72ad-448f-8403-7d2627f7f54c'::uuid, 74),  -- Excel baris 78: Peta Jasa Lingkungan Hidup Pengatur Air
    ('5b8b5848-f835-4252-b5a9-f840a1e3e612'::uuid, 75),  -- Excel baris 79: Peta Lokasi Program Kampung Iklim (Proklim)
    ('12d0d9e5-018a-4be7-bee0-c87c68294140'::uuid, 76),  -- Excel baris 80: Peta Mangrove
    ('e487c082-a24b-447d-99ee-7f2740ac4518'::uuid, 77),  -- Excel baris 81: Peta Sebaran Penyelesaian Sengketa Lingkungan Hidup Di Luar Pengadilan
    ('c044f4b3-7e5e-4eda-96ec-8a9d0fa190d9'::uuid, 78),  -- Excel baris 82: Peta Sebaran Penyelesaian Sengketa Lingkungan Hidup melalui Pengadilan
    ('e67c1c6d-8fc9-44b9-ad9c-f386fb5989fd'::uuid, 79),  -- Excel baris 83: Peta Kesatuan Pengelolaan Hutan Produksi (KPHP) dan Kesatuan Pengelola
    ('6539664d-8084-428e-ae5c-35bd0eba6f87'::uuid, 80),  -- Excel baris 84: Peta Persetujuan Penggunaan Kayu Kegiatan Non Kehutanan
    ('e2bd3527-5482-45bb-aac3-864af42d36e7'::uuid, 81),  -- Excel baris 85: Peta Pembuatan dan Penggunaan Jalan Koridor
    ('51869918-3c7a-41ec-82d1-eea7b1cd55a1'::uuid, 82),  -- Excel baris 86: Peta Profil Kawasan Suaka Alam (KSA), Kawasan Pelestarian Alam (KPA) d
    ('2542a5db-2115-47ad-9658-398490dbe733'::uuid, 83),  -- Excel baris 87: Peta Rehabilitasi Hutan dan Lahan (RHL) Mangrove
    ('c368c6f7-d7ab-421f-b484-bb23c846d444'::uuid, 84),  -- Excel baris 88: Peta Kebakaran Hutan
    ('bf78ee53-dfb1-48ff-a7a9-c89250b2dfea'::uuid, 85),  -- Excel baris 89: Peta Obyek Wisata
    ('f505bdbc-6b65-4be9-85b9-5c2ea869ac8b'::uuid, 86),  -- Excel baris 90: Peta Pokdarwis
    ('11491147-52da-4049-86ff-47383d800ec7'::uuid, 87),  -- Excel baris 91: Peta Desa Wisata
    ('e1e88d15-d348-4b8d-ab9f-0533f4b06cba'::uuid, 88),  -- Excel baris 92: Peta Sebaran Izin Usaha Industri Besar
    ('39bb5731-438e-45c0-bca4-925dd89e20e4'::uuid, 89),  -- Excel baris 93: Peta Sebaran Koperasi
    ('7be8f3a0-6303-412d-9cf0-9a77d9bcb78e'::uuid, 90),  -- Excel baris 94: Peta Kawasan Industri
    ('87c2e11a-02fa-4a75-be50-95fef675f37f'::uuid, 91),  -- Excel baris 95: Peta Sebaran UKM Ekspor dan Potensial Ekspor
    ('dfdee31c-18ec-4f4c-8b72-32cdfd87164d'::uuid, 92),  -- Excel baris 96: Peta Sebaran Perusahaan di kawasan industri
    ('2f31b90d-692e-4275-9dc8-a6fe7c6d2f3b'::uuid, 93),  -- Excel baris 97: Peta Wilayah Pusat Pertumbuhan Industri skala 1:50.000
    ('a55dbcd5-7d1f-4d9e-ab84-f2a28f13a838'::uuid, 94),  -- Excel baris 98: Peta Kawasan Industri Eksisting dan Peta Rencana Kawasan Industri skal
    ('64c5e989-d035-4d66-8ab3-5ccf4d0ccb6d'::uuid, 95),  -- Excel baris 99: Peta Penetapan Kawasan Ekonomi Khusus (KEK)
    ('39bfa936-3f8a-4d96-a4d4-69a04111a937'::uuid, 96),  -- Excel baris 100: Peta Sebaran Menara Pemancar Telekomunikasi
    ('4697fd34-98a0-4d9e-9ccd-d52a0a4241e2'::uuid, 97),  -- Excel baris 101: Peta Jaringan Serat Optik
    ('9262bfdc-07a5-4d0b-a9f4-49b33f6513dc'::uuid, 98),  -- Excel baris 102: Peta Sebaran Internet Desa
    ('e9cb9233-2d4d-47e1-a6db-aae54890c87d'::uuid, 99),  -- Excel baris 103: Peta Sebaran Blankspot Desa/Kelurahan
    ('4dc6ec41-b457-478c-b85c-f5c6762c0c54'::uuid, 100),  -- Excel baris 104: Peta Sebaran Perpustakaan (Umum, khusus, sekolah, perguruan tinggi)
    ('77a4f052-2689-45d1-83e2-20cb6febd9de'::uuid, 101),  -- Excel baris 105: Peta Sebaran Buncu Baca
    ('1c243ee0-8a1d-42f0-87b7-116d0d4ab780'::uuid, 102),  -- Excel baris 106: Peta Desa/Kelurahan Berprestasi
    ('00507dd6-0da6-4513-a73c-fbd4f4fc7059'::uuid, 103),  -- Excel baris 107: Peta Pendampingan masyarakat hukum adat
    ('729f3cc1-371f-46f9-87fd-8b720a03a007'::uuid, 104),  -- Excel baris 108: Peta Pendampingan terhadap Bumdes Aktif dan Berbadan Hukum
    ('01815549-704a-4ddf-99db-ce070c323ca5'::uuid, 105),  -- Excel baris 109: Peta Pendampingan terhadap Posyandu
    ('91703bcf-2e01-4b84-b449-9ee631208678'::uuid, 106),  -- Excel baris 110: Peta Potensi Desa (Sosial-Ekonomi)
    ('30a21472-832d-474d-9c3d-ba8eacb56ffe'::uuid, 107),  -- Excel baris 111: Peta Sebaran Badan Usaha Milik Desa
    ('2dca6434-d3e5-4557-bb22-998a85e61ff6'::uuid, 108),  -- Excel baris 112: Peta Sebaran Desa Tertinggal
    ('7642493f-9bc3-45fc-ab41-c45122ee8e93'::uuid, 109),  -- Excel baris 113: Peta Sebaran Status Perkembangan Desa
    ('f59a7926-7f62-4ea6-8c38-f8a10a8d5392'::uuid, 110),  -- Excel baris 114: Peta Sebaran Pos Pelayanan Teknologi (Posyantek)
    ('6b4ee246-4e67-4371-bb0c-7b0e66b9ba6a'::uuid, 111),  -- Excel baris 115: Peta UPTD Panti Sosial
    ('1c2b5af2-5af2-4ad7-8909-f25227d86092'::uuid, 112),  -- Excel baris 116: Peta Lembaga Kesejahteraan Sosial
    ('dc9512c5-d28b-48f0-8339-57f3dbea717e'::uuid, 113),  -- Excel baris 117: Peta Lembaga Konsultasi Kesejahteraan Keluarga (LK3)
    ('d1b10bbc-0223-45f3-baf4-180e4a3819af'::uuid, 114),  -- Excel baris 118: Peta Taman Makam Pahlawan Nasional Provinsi
    ('adcb3c3d-fe18-4d71-a9ec-fee5d080ea22'::uuid, 115),  -- Excel baris 119: Peta Profil Kependudukan
    ('831b1e25-59c2-4713-a99c-534fe51ea980'::uuid, 116),  -- Excel baris 120: Peta Kepadatan Penduduk Tingkat Kota/Kab, Kecamatan per Tahun
    ('c586d5ab-54c5-4838-97ce-1db358576715'::uuid, 117),  -- Excel baris 121: Peta Sebaran Indeks Pembangunan Keluarga
    ('8de9c6af-94f3-4410-8501-673fde1e9ae9'::uuid, 118),  -- Excel baris 122: Peta Kawasan Cagar Budaya
    ('aad04c3b-24dd-4b87-b729-4baa2909881b'::uuid, 119),  -- Excel baris 123: Peta Sebaran Gedung Kesenian
    ('19151c99-d6c6-48ce-9242-94ef825119cc'::uuid, 120),  -- Excel baris 124: Peta Sebaran Lembaga Kesenian
    ('485c8fcd-46ef-45ba-97e0-769eff95a417'::uuid, 121),  -- Excel baris 125: Peta Sebaran Lokasi Cagar Budaya
    ('d89d0996-f15e-484b-9d2a-a8ed1b9cfcb9'::uuid, 122),  -- Excel baris 126: Peta Sebaran Lokasi Museum
    ('0b558df6-ae03-4c65-b10f-e9b20378fc18'::uuid, 123),  -- Excel baris 127: Peta Sebaran Lokasi Satuan Pendidikan SMA, SMK dan SLB
    ('51a26406-cf85-435b-838c-12ac45d003b2'::uuid, 124),  -- Excel baris 128: Peta Sebaran Lokasi Unit Sekolah Baru
    ('1d924af6-12d1-47f2-9102-7307b171eb93'::uuid, 125),  -- Excel baris 129: Peta Sebaran Monumen Sejarah
    ('05fff3d8-5d1a-4469-a3c5-f1c752cdc5e4'::uuid, 126),  -- Excel baris 130: Peta Sebaran Objek Pemajuan Kebudayaan
    ('652335db-1a2c-4312-b96d-4047612d4191'::uuid, 127),  -- Excel baris 131: Peta Sebaran Pembangunan Asrama Sekolah
    ('1447008a-19d9-4972-b231-b1e718b94b66'::uuid, 128),  -- Excel baris 132: Peta Sebaran Pembangunan Laboratorium
    ('d6938550-02cf-49cd-9b04-2c90e015d3f2'::uuid, 129),  -- Excel baris 133: Peta Sebaran Pembangunan Ruang Guru/Kepala Sekolah/TU
    ('f7749947-9ba5-48a4-8399-34a258b48692'::uuid, 130),  -- Excel baris 134: Peta Sebaran Pembangunan Ruang Kelas Baru
    ('42d15aca-3204-405b-90f8-5e23c3f53fbc'::uuid, 131),  -- Excel baris 135: Peta Sebaran Pembangunan Ruang Praktik Siswa
    ('410e8971-fb4a-423c-a9ef-5703462ebbbb'::uuid, 132),  -- Excel baris 136: Peta Sebaran Pembangunan Rumah Dinas Kepala Sekolah/Guru/Penjaga Sekol
    ('b22f3f9a-d84c-4ed7-a429-18bc4fcc90f4'::uuid, 133),  -- Excel baris 137: Peta Sebaran Pembangunan Sarana, Prasarana dan Utilitas Sekolah
    ('9718ea60-8fc3-40a8-b4a1-f2b38472e3b3'::uuid, 134),  -- Excel baris 138: Peta Sebaran Pembangunan Unit Kesehatan Sekolah
    ('ecb9b3e7-b5c1-4602-a14f-ebe44b8425d6'::uuid, 135),  -- Excel baris 139: Peta Sebaran Rehabilitasi Asrama Sekolah
    ('b12d06d4-661b-47e4-a0f7-7b51fd3b96a5'::uuid, 136),  -- Excel baris 140: Peta Sebaran Rehabilitasi Laboratorium
    ('7245a179-e6fb-49a0-b7d2-24eba84f9bdf'::uuid, 137),  -- Excel baris 141: Peta Sebaran Rehabilitasi Perpustakaan Sekolah
    ('51aeb145-0d58-49e7-9707-b25373675724'::uuid, 138),  -- Excel baris 142: Peta Sebaran Rehabilitasi Ruang Guru/Kepala Sekolah/TU
    ('39d67c19-9801-49c4-8e33-b6c6449294c4'::uuid, 139),  -- Excel baris 143: Peta Sebaran Rehabilitasi Ruang Kelas Sekolah
    ('a4029ee2-e84f-4d3a-bc9b-2572a136800a'::uuid, 140),  -- Excel baris 144: Peta Sebaran Rehabilitasi Rumah Dinas Kepala Sekolah/Guru/Penjaga Seko
    ('727661f7-def4-46e4-958c-e0188f3271fc'::uuid, 141),  -- Excel baris 145: Peta Sebaran Rehabilitasi Sarana, Prasarana dan Utilitas Sekolah
    ('6ca1c8c1-ff11-4411-bc28-830e77465482'::uuid, 142),  -- Excel baris 146: Peta Sebaran Sarana Penyelenggaraan Seni dan Budaya
    ('72ae0360-f98b-45e0-ba4a-479fbe28548b'::uuid, 143),  -- Excel baris 147: Peta Sebaran Rumah Sakit
    ('477be8c2-a554-45ab-b56f-80a4d176223f'::uuid, 144),  -- Excel baris 148: Peta Desa/Kelurahan Terkena KLB
    ('e61f5e02-b87c-456e-84d7-f87b37537c7d'::uuid, 145),  -- Excel baris 149: Peta Sebaran Gudang Farmasi
    ('1dde62fd-fd84-4099-a655-3513d5f9af0d'::uuid, 146),  -- Excel baris 150: Peta Jaringan Drainase Provinsi
    ('9f169c12-fc59-4781-abf8-effc09cbdaaf'::uuid, 147),  -- Excel baris 151: Peta Jaringan Irigasi Teknis Primer dan Sekunder (Kewenangan Provinsi)
    ('d854589b-b24d-4f2c-bb2e-a477a216e298'::uuid, 148),  -- Excel baris 152: Peta Daerah Irigasi Teknis Primer dan Sekunder (Kewenangan Provinsi)
    ('e3cf13e8-83cb-4681-9837-31a4b3051597'::uuid, 149),  -- Excel baris 153: Peta Luas Baku Sawah Daerah Irigasi (Kewenangan Provinsi)
    ('fa810cbe-3cd8-4e9b-aaa3-6fa7f7c5c038'::uuid, 150),  -- Excel baris 154: Peta Sawah Fungsional Daerah Irigasi (Kewenangan Provinsi)
    ('9d0a4e22-e9a4-44f5-af00-78c843f4f1d2'::uuid, 151),  -- Excel baris 155: Peta Sawah Potensial Daerah Irigasi (Kewenangan Provinsi)
    ('b9b3087e-5113-4af3-845b-a698da34668c'::uuid, 152),  -- Excel baris 156: Peta Sawah Terlayani Irigasi (Kewenangan Provinsi)
    ('b9f52338-9021-49f2-b648-630e8d37f417'::uuid, 153),  -- Excel baris 157: Peta Kawasan Permukiman (RTRW)
    ('9488fa63-0ecc-49f6-b436-cc8594138539'::uuid, 154),  -- Excel baris 158: Peta Kawasan Budidaya
    ('72c38c7e-4d92-4829-af23-4b7952e6c367'::uuid, 155),  -- Excel baris 159: Peta Kawasan Budidaya (Kehutanan)
    ('8042bf2a-cace-4a36-a3ab-5ff9a5f1a681'::uuid, 156),  -- Excel baris 160: Peta Kawasan Budidaya (Non Kehutanan)
    ('c6b8916a-a176-444c-a809-b13f897fc473'::uuid, 157),  -- Excel baris 161: Peta Kawasan Lindung
    ('77099f0a-66b7-4839-a738-de0643eba85a'::uuid, 158),  -- Excel baris 162: Peta Pengelolaan wilayah laut 0 s/d 12 mil
    ('fe620e84-cd43-4806-a5cf-4c92333d5af9'::uuid, 159),  -- Excel baris 163: Peta Genangan Banjir Perkotaan (Area)
    ('349d3626-bedf-4691-b47b-03863a4af72a'::uuid, 160),  -- Excel baris 164: Peta Pantai Kritis
    ('33c8a7e4-d17d-4270-aa5a-6f1c2b3d5d2e'::uuid, 161),  -- Excel baris 165: Peta Sungai yang Dinormalisasi
    ('16d6a0cf-7048-42ea-911a-4d65abbf6196'::uuid, 162),  -- Excel baris 166: Peta Sebaran Pos Hidrologi
    ('34aba852-38f9-4eb1-a2c4-217f1f6f73bb'::uuid, 163),  -- Excel baris 167: Peta Kawasan Permukiman
    ('758da192-7eee-424d-bb09-952918e3982d'::uuid, 164),  -- Excel baris 168: Peta Kawasan Permukiman Kumuh
    ('c76fe31e-6b95-434f-af3d-6bb8c2b2f4f4'::uuid, 165),  -- Excel baris 169: Peta Sebaran Rumah Tidak Layak Huni
    ('cea16052-788f-4b29-95f4-d3969363924f'::uuid, 166),  -- Excel baris 170: Peta Prasarana Sarana Utilitas
    ('664ac0c4-d30c-4bcf-897d-980cda38fdfe'::uuid, 167),  -- Excel baris 171: Peta Jalan Provinsi
    ('0d5cfe41-37a0-4562-b6e9-2530812492ef'::uuid, 168),  -- Excel baris 172: Peta Jembatan Kewenangan Provinsi
    ('1b386941-b11d-4310-839c-f0af666a0db1'::uuid, 169),  -- Excel baris 173: Peta Titik Rawan Longsor Jalan Provinsi
    ('e920f87e-1c41-47a1-9be5-2c7aa522ee05'::uuid, 170),  -- Excel baris 174: Peta Waduk
    ('f390493d-5126-4eaa-b8af-97ffedebf0a4'::uuid, 171),  -- Excel baris 175: Peta Turap Sungai
    ('90057029-ba15-4306-97c0-6932126f6d4e'::uuid, 172),  -- Excel baris 176: Peta Rencana Waduk
    ('43ed7a94-c0ed-4bf0-a23d-5ee50b70818c'::uuid, 173),  -- Excel baris 177: Peta Rencana Drainsae
    ('9d00f1be-6d75-4ce8-8c47-dceae429306f'::uuid, 174),  -- Excel baris 178: Peta Rencana Bendungan
    ('fb5cc368-cfda-4b24-b74e-11a3a7d403c5'::uuid, 175),  -- Excel baris 179: Peta Rencana Bendung
    ('5233add4-9fce-462f-b699-4d75f4e7953a'::uuid, 176),  -- Excel baris 180: Peta Rawa
    ('d00d9518-eaef-4c45-8805-4474acd56c50'::uuid, 177),  -- Excel baris 181: Peta Pengaman Pantai
    ('e43baa18-6f74-4d57-8b07-7d6a9355f552'::uuid, 178),  -- Excel baris 182: Peta Bendung (titik)
    ('24d6eb63-2a92-4dd0-a99d-a30ae80bc070'::uuid, 179),  -- Excel baris 183: Peta Bendungan (titik)
    ('dad5d61f-0932-4950-ba74-e1cdf29ca69c'::uuid, 180),  -- Excel baris 184: Peta Embung (titik)
    ('8f26e47a-61fd-4dc8-a3ef-54285057f721'::uuid, 181),  -- Excel baris 185: Peta Daerah Aliran Sungai
    ('0d17b6c7-7e5b-4642-b736-1336000dc305'::uuid, 182),  -- Excel baris 186: Sungai (garis) 50k
    ('f1d8586f-9df6-4d98-96ec-cb6e452c4e74'::uuid, 183),  -- Excel baris 187: Sungai (garis) 250k
    ('8a8c88c8-bbcc-4464-94f3-4facd2b71111'::uuid, 184),  -- Excel baris 188: Peta Wilayah Sungai
    ('c609553d-7140-4499-883f-910cdd93bf4e'::uuid, 185),  -- Excel baris 189: Peta Sebaran Lokasi Sistem Penyediaan Air Minum (SPAM) Regional
    ('57ebf360-a308-452d-a908-0cc541c43fbd'::uuid, 186),  -- Excel baris 190: Peta Ketersediaan Air Baku
    ('50236dee-2c97-47cc-b857-e35cdbc651f3'::uuid, 187),  -- Excel baris 191: Peta Daerah Irigasi Rawa skala 1:5.000
    ('2b4dcb68-399b-412a-9a76-229265e379ed'::uuid, 188),  -- Excel baris 192: Peta Neraca Sumber Daya Air skala 1:50.000
    ('bf132698-83b8-4a73-88db-3ce0c1b25ffc'::uuid, 189),  -- Excel baris 193: Peta Sebaran Lokasi Pengaman Pantai skala 1:50.000
    ('671cc55f-02ad-442c-9d7d-56f7cb3b45d9'::uuid, 190),  -- Excel baris 194: Peta Sebaran Lokasi Bendungan Eksisting dan Peta Sebaran Lokasi Bendun
    ('95d86bfb-d048-4a74-b041-65d22f30f069'::uuid, 191),  -- Excel baris 195: Peta Sebaran Lokasi Pengendali Banjir skala 1:50.000
    ('1a46801f-758b-4e10-a51f-7cd31c8d904c'::uuid, 192),  -- Excel baris 196: Peta Daerah Irigasi Permukaan skala 1:5.000
    ('12111f29-16ab-4995-861f-72ff42e3ac5b'::uuid, 193),  -- Excel baris 197: Peta Daerah Irigasi Rawa skala 1:5.000
    ('4add33cc-0da6-4930-8b38-4f2c90706e02'::uuid, 194),  -- Excel baris 198: Peta Sebaran Lokasi Pengendalian Sedimen
    ('83c8d1ea-e01e-4365-8fc7-64e6a6845c2d'::uuid, 195),  -- Excel baris 199: Peta Sebaran Penerangan Jalan Umum (PJU)
    ('e41d46be-d6a9-44bd-898f-07343ba9c4e0'::uuid, 196),  -- Excel baris 200: Peta Sebaran Pembangunan  Rumah Korban Bencana
    ('2fd0bd34-ab30-4e13-b01b-b7d1e568d85b'::uuid, 197),  -- Excel baris 201: Peta Sebaran  Rehabilitasi Rumah Korban Bencana
    ('17a5b606-357b-44bd-a9e9-ce6f948aa0e8'::uuid, 198),  -- Excel baris 202: Peta Terminal Tipe B
    ('fde15b59-c82e-4659-aaba-83858d7409ad'::uuid, 199),  -- Excel baris 203: Peta Trayek Angkutan Umum Antar kota
    ('181bf2b0-8915-4496-9db6-cf62cbe08804'::uuid, 200),  -- Excel baris 204: Peta Pelabuhan Laut Pengumpan Regional
    ('f7d7a97a-5785-4add-aa2d-e4e7d7598a2e'::uuid, 201),  -- Excel baris 205: Peta Pelabuhan Sungai
    ('f38637b3-f0ce-4efd-9694-49b981989bda'::uuid, 202),  -- Excel baris 206: Peta Alur Pelayaran Sungai-Danau dan Penyeberangan skala 1:50.000
    ('a4243eb8-559f-41a0-a355-cde7c396c021'::uuid, 203),  -- Excel baris 207: Peta Sebaran Rambu Jalan di Jalan Provinsi
    ('cb499786-c423-450c-8cc0-492831b51164'::uuid, 204),  -- Excel baris 208: Peta Sebaran Pagar Pengaman Jalan di Jalan Provinsi
    ('5741d4f1-ac47-4c11-9d4a-be76e87770f1'::uuid, 205),  -- Excel baris 209: Peta Sebaran LPJU di Jalan Provinsi
    ('15637ad7-7e93-4da8-81b5-e29306d80c21'::uuid, 206),  -- Excel baris 210: Peta Sebaran APILL di Jalan Provinsi
    ('623d9949-8808-4c30-9f37-54be4850fab6'::uuid, 207),  -- Excel baris 211: Peta Cekungan Air Tanah Wilayah Sungai Karangan
    ('8b0d40ff-03b2-4945-8626-b54776871708'::uuid, 208),  -- Excel baris 212: Peta Kawasan Bentang Alam Karst
    ('48ef37ba-cf0d-4051-967e-5ec075b96b91'::uuid, 209),  -- Excel baris 213: Peta Sebaran Desa Berlistrik PLN dan Non-PLN
    ('81ba5a49-b888-4abf-932b-9d24814722e0'::uuid, 210),  -- Excel baris 214: Peta Sebaran Pemilik Sumur Bor dalam Zona Wilayah Sungai
    ('4e9295be-6663-4fad-a376-32635009250a'::uuid, 211),  -- Excel baris 215: Peta Potensi warisan geologi
    ('2b43844b-ba35-4554-992d-f73158fa941e'::uuid, 212),  -- Excel baris 216: Peta Kualitas air tanah sebagai air baku dalam Zona Wilayah Sungai
    ('80a969de-665a-4dcb-9e4c-ccf63e0816bf'::uuid, 213),  -- Excel baris 217: Peta Perizinan berusaha di bidang pertambangan Mineral Bukan Logam dan
    ('5e4186eb-30ce-4ebd-957d-7af92ff099da'::uuid, 214),  -- Excel baris 218: Peta Sumber Daya Panas Bumi
    ('8654b0bb-7bf9-4e6a-b3a2-734289f36fc8'::uuid, 215),  -- Excel baris 219: Peta Pembangkit listrik Non PLN dalam kewenangan Pemerintah Provinsi
    ('4fb3045d-bdb4-4f86-8e24-dca3a037db3d'::uuid, 216),  -- Excel baris 220: Peta Wilayah Pertambangan Rakyat
    ('28adb588-18dd-484e-ab0f-2e7b8891eee8'::uuid, 217),  -- Excel baris 221: Peta Zona Konservasi Air Tanah
    ('d50f0dbf-bb2e-4b78-949c-983e0124c343'::uuid, 218),  -- Excel baris 222: Peta Perizinan Berusaha di Bidang Pertambangan skala 1: 50.000
    ('88e3a6f3-677a-4de8-a4ee-9bff50c0b4ed'::uuid, 219),  -- Excel baris 223: Peta Delineasi Geopark Sangkulirang Mangkalihat
    ('107b26f7-1a7a-41b4-aefd-72760a35dfc0'::uuid, 220),  -- Excel baris 224: Peta Pembinaan terhadap Warga Transmigrasi yang telah di tempatkan
    ('b41fab8d-a18f-43d3-9888-654bf401e5ba'::uuid, 221),  -- Excel baris 225: Peta Sebaran Lokasi Balai Latihan Kerja
    ('57f77080-207e-4435-a885-36958971925c'::uuid, 222)  -- Excel baris 226: Peta Lokasi Pelatihan Kerja
) AS v(id, urutan)
WHERE d.id = v.id;
