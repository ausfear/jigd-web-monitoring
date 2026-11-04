"use client";

import React, { useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/lembar-peta";
import { cn } from "@/lib/utils";
import { useDialogState } from "@/lib/use-dialog-state";
import { updateDaftarDataBertahap } from "@/lib/update-bertahap";
import type { CacheLayerGeoportal, DaftarData, MasterKugi } from "@/types/database";

type Aksi = "tag" | "layer_utama" | "layer_pelengkap" | "tahun" | "kugi";

const PILIHAN_AKSI: { id: Aksi; label: string }[] = [
  { id: "tag", label: "Tag / bidang" },
  { id: "layer_utama", label: "Layer utama" },
  { id: "layer_pelengkap", label: "Layer pelengkap" },
  { id: "tahun", label: "Tahun berlaku" },
  { id: "kugi", label: "KUGI" },
];

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: DaftarData[];
  cachedLayers: CacheLayerGeoportal[];
  kugiList: MasterKugi[];
  availableTags: string[];
  yearOptions: number[];
  onSuccess: () => void;
}

const samaArray = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Daftar layer yang bisa dicari; layer milik OPD data terpilih ditampilkan lebih dulu. */
function PemilihLayer({
  layers,
  owners,
  value,
  onChange,
}: {
  layers: CacheLayerGeoportal[];
  owners: Set<string>;
  value: string | null;
  onChange: (uuid: string) => void;
}) {
  const [cari, setCari] = useState("");
  const [semuaOpd, setSemuaOpd] = useState(owners.size === 0);

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return layers
      .filter((l) => l.uuid)
      .filter((l) => semuaOpd || owners.has((l.owner_username || "").toLowerCase()))
      .filter((l) => !q || `${l.title} ${l.name} ${l.owner_username}`.toLowerCase().includes(q))
      .slice(0, 200);
  }, [layers, owners, semuaOpd, cari]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari judul atau nama layer…"
          aria-label="Cari layer"
          className={cn(controlClass, "w-full pl-9")}
        />
      </div>
      {owners.size > 0 && (
        <label className="flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer">
          <input type="checkbox" checked={semuaOpd} onChange={(e) => setSemuaOpd(e.target.checked)} className="accent-qty" />
          Tampilkan layer semua OPD (bawaan: hanya layer milik OPD data terpilih)
        </label>
      )}
      <ul className="max-h-56 overflow-y-auto border border-ink/30 divide-y divide-rule">
        {tampil.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-ink-2">Tidak ada layer yang cocok.</li>
        ) : (
          tampil.map((l) => {
            const dipilih = value === l.uuid;
            return (
              <li key={l.uuid}>
                <button
                  type="button"
                  onClick={() => onChange(l.uuid!)}
                  aria-pressed={dipilih}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-qty/10 cursor-pointer",
                    dipilih && "bg-qty/15"
                  )}
                >
                  <Check className={cn("mt-0.5 h-4 w-4 shrink-0 text-qty", !dipilih && "invisible")} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{l.title || l.name}</span>
                    <span className="block text-[13px] text-ink-2 break-all">
                      {l.name !== l.title && `${l.name}, `}@{l.owner_username}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/**
 * Ubah beberapa daftar data sekaligus (bulk action): tag/bidang, layer utama, layer
 * pelengkap, tahun berlaku, atau KUGI. Setiap baris tetap diperbarui sendiri-sendiri,
 * jadi trigger status dan riwayat perubahan mencatat per daftar data.
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  records,
  cachedLayers,
  kugiList,
  availableTags,
  yearOptions,
  onSuccess,
}: BulkEditDialogProps) {
  const [aksi, setAksi] = useState<Aksi>("tag");
  const [tag, setTag] = useState("");
  const [layerUuid, setLayerUuid] = useState<string | null>(null);
  const [kosongkan, setKosongkan] = useState(false); // layer utama / KUGI dikosongkan
  const [mode, setMode] = useState<"tambah" | "hapus">("tambah"); // layer pelengkap & tahun
  const [tahun, setTahun] = useState<number>(yearOptions[0] ?? new Date().getFullYear());
  const [namaUnsur, setNamaUnsur] = useState("");
  const [kugiId, setKugiId] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { isOpen, setIsOpen } = useDialogState(open, onOpenChange, () => {
    setAksi("tag");
    setTag("");
    setLayerUuid(null);
    setKosongkan(false);
    setMode("tambah");
    setTahun(yearOptions[0] ?? new Date().getFullYear());
    setNamaUnsur("");
    setKugiId("");
    setProgress(null);
    setErrorMessage(null);
  });

  const owners = useMemo(
    () =>
      new Set(
        records
          .map((r) => r.master_opd?.username_jigd?.toLowerCase())
          .filter((u): u is string => Boolean(u))
      ),
    [records]
  );
  const namaUnsurOptions = useMemo(
    () => [...new Set(kugiList.map((k) => k.nama_unsur).filter((n): n is string => Boolean(n)))].sort(),
    [kugiList]
  );
  const kodeOptions = useMemo(
    () => kugiList.filter((k) => k.nama_unsur === namaUnsur.trim() && k.kode_unsur),
    [kugiList, namaUnsur]
  );
  const unsurDikenal = namaUnsurOptions.includes(namaUnsur.trim());

  /** Perubahan untuk satu baris, atau null bila nilainya sudah sesuai. */
  const hitungPatch = (d: DaftarData): Record<string, unknown> | null => {
    const pelengkap = d.layer_pelengkap_uuids || [];
    const years = d.tahun_berlaku || [];
    switch (aksi) {
      case "tag": {
        const baru = tag.trim() || null;
        return (d.tag_bidang || null) === baru ? null : { tag_bidang: baru };
      }
      case "layer_utama": {
        if (kosongkan) return d.layer_utama_uuid ? { layer_utama_uuid: null, status_keterisian: false } : null;
        if (!layerUuid || d.layer_utama_uuid === layerUuid) return null;
        return {
          layer_utama_uuid: layerUuid,
          layer_pelengkap_uuids: pelengkap.filter((u) => u !== layerUuid),
          status_keterisian: true,
        };
      }
      case "layer_pelengkap": {
        if (!layerUuid) return null;
        const next =
          mode === "tambah"
            ? d.layer_utama_uuid === layerUuid || pelengkap.includes(layerUuid)
              ? pelengkap
              : [...pelengkap, layerUuid]
            : pelengkap.filter((u) => u !== layerUuid);
        return samaArray(next, pelengkap) ? null : { layer_pelengkap_uuids: next };
      }
      case "tahun": {
        const next =
          mode === "tambah"
            ? [...new Set([...years, tahun])].sort((a, b) => a - b)
            : years.filter((y) => y !== tahun);
        // Daftar data tanpa tahun sama sekali dilewati (gunakan hapus data bila memang tidak berlaku)
        if (next.length === 0) return null;
        return samaArray(next, years) ? null : { tahun_berlaku: next };
      }
      case "kugi": {
        if (kosongkan) {
          return d.kugi_id || d.kugi_nama_unsur ? { kugi_id: null, kugi_nama_unsur: null } : null;
        }
        const nama = namaUnsur.trim();
        if (!nama) return null;
        const id = kugiId || null;
        return d.kugi_nama_unsur === nama && (d.kugi_id || null) === id ? null : { kugi_nama_unsur: nama, kugi_id: id };
      }
    }
  };

  const perubahan = records
    .map((d) => ({ id: d.id, patch: hitungPatch(d) }))
    .filter((r): r is { id: string; patch: Record<string, unknown> } => r.patch !== null);
  const tanpaTahun =
    aksi === "tahun" && mode === "hapus"
      ? records.filter((d) => (d.tahun_berlaku || []).length === 1 && d.tahun_berlaku[0] === tahun).length
      : 0;
  const isSaving = progress !== null;

  const handleApply = async () => {
    if (perubahan.length === 0) return;
    try {
      setErrorMessage(null);
      setProgress({ done: 0, total: perubahan.length });
      await updateDaftarDataBertahap(perubahan, (done) => setProgress({ done, total: perubahan.length }));
      setIsOpen(false);
      onSuccess();
    } catch (err) {
      setErrorMessage((err as { message?: string })?.message || "Gagal menyimpan perubahan.");
      onSuccess(); // sebagian baris mungkin sudah tersimpan
    } finally {
      setProgress(null);
    }
  };

  const radio = (name: string, value: string, checked: boolean, onChange: () => void, label: string) => (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="accent-qty" />
      {label}
    </label>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !isSaving && setIsOpen(o)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-ink">Ubah {records.length} daftar data sekaligus</DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            Pilih bagian yang diubah. Nilai baru diterapkan ke semua daftar data terpilih; daftar data yang nilainya
            sudah sesuai dilewati.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 border border-bound border-l-4 p-3 text-sm text-bound">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">Yang diubah</legend>
            <div className="flex flex-wrap gap-1.5">
              {PILIHAN_AKSI.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={aksi === p.id}
                  onClick={() => {
                    setAksi(p.id);
                    setLayerUuid(null);
                    setKosongkan(false);
                    setMode("tambah");
                  }}
                  className={cn(
                    "border px-3 py-1.5 text-sm cursor-pointer transition-colors",
                    aksi === p.id ? "border-qty bg-qty text-sheet" : "border-ink/40 text-ink hover:bg-ink/5"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          {aksi === "tag" && (
            <div className="space-y-1.5">
              <label htmlFor="bulk-tag" className="text-sm font-semibold text-ink">Tag / bidang baru</label>
              <input
                id="bulk-tag"
                list="bulk-tag-options"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Pilih atau ketik tag baru"
                className={cn(controlClass, "w-full")}
              />
              <datalist id="bulk-tag-options">
                {availableTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <p className="text-[13px] text-ink-2">Kosongkan untuk menghapus tag dari data terpilih.</p>
            </div>
          )}

          {aksi === "layer_utama" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {radio("bulk-utama", "pilih", !kosongkan, () => setKosongkan(false), "Pilih layer utama")}
                {radio("bulk-utama", "kosong", kosongkan, () => setKosongkan(true), "Kosongkan layer utama")}
              </div>
              {!kosongkan && <PemilihLayer layers={cachedLayers} owners={owners} value={layerUuid} onChange={setLayerUuid} />}
              <p className="text-[13px] text-ink-2">
                {kosongkan
                  ? "Status data terpilih menjadi Belum terisi."
                  : "Layer lama yang diganti tidak dipindah ke layer pelengkap. Status menjadi Terisi."}
              </p>
            </div>
          )}

          {aksi === "layer_pelengkap" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {radio("bulk-pelengkap", "tambah", mode === "tambah", () => setMode("tambah"), "Tambahkan layer pelengkap")}
                {radio("bulk-pelengkap", "hapus", mode === "hapus", () => setMode("hapus"), "Lepaskan layer pelengkap")}
              </div>
              <PemilihLayer layers={cachedLayers} owners={owners} value={layerUuid} onChange={setLayerUuid} />
            </div>
          )}

          {aksi === "tahun" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {radio("bulk-tahun", "tambah", mode === "tambah", () => setMode("tambah"), "Tambahkan tahun")}
                {radio("bulk-tahun", "hapus", mode === "hapus", () => setMode("hapus"), "Hapus tahun")}
              </div>
              <select
                aria-label="Tahun"
                value={tahun}
                onChange={(e) => setTahun(Number(e.target.value))}
                className={cn(controlClass, "w-40 cursor-pointer")}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {tanpaTahun > 0 && (
                <p className="text-[13px] text-contour">
                  {tanpaTahun} daftar data hanya berlaku di {tahun}, jadi dilewati agar tidak kehilangan semua tahun.
                </p>
              )}
            </div>
          )}

          {aksi === "kugi" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {radio("bulk-kugi", "pilih", !kosongkan, () => setKosongkan(false), "Tetapkan KUGI")}
                {radio("bulk-kugi", "kosong", kosongkan, () => setKosongkan(true), "Kosongkan KUGI")}
              </div>
              {!kosongkan && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="bulk-unsur" className="text-sm font-semibold text-ink">Nama unsur</label>
                    <input
                      id="bulk-unsur"
                      list="bulk-unsur-options"
                      value={namaUnsur}
                      onChange={(e) => {
                        setNamaUnsur(e.target.value.toUpperCase());
                        setKugiId("");
                      }}
                      placeholder="Contoh: CAGARBUDAYA_PT"
                      className={cn(controlClass, "w-full")}
                    />
                    <datalist id="bulk-unsur-options">
                      {namaUnsurOptions.map((n) => (
                        <option key={n} value={n} />
                      ))}
                    </datalist>
                    {namaUnsur.trim() && !unsurDikenal && (
                      <p className="text-[13px] text-contour">Nama unsur ini tidak ada di master KUGI.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="bulk-kode" className="text-sm font-semibold text-ink">Kode unsur (opsional)</label>
                    <select
                      id="bulk-kode"
                      value={kugiId}
                      onChange={(e) => setKugiId(e.target.value)}
                      disabled={kodeOptions.length === 0}
                      className={cn(controlClass, "w-full cursor-pointer disabled:opacity-50")}
                    >
                      <option value="">Tanpa kode</option>
                      {kodeOptions.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.kode_unsur}
                          {k.katalog_unsur ? ` (${k.katalog_unsur})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="border-t border-rule pt-3 text-sm text-ink">
            {perubahan.length > 0
              ? `${perubahan.length} dari ${records.length} daftar data akan berubah.`
              : "Belum ada perubahan: pilih nilai baru, atau semua data terpilih sudah sesuai."}
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving} className="border-rule">
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={isSaving || perubahan.length === 0}
            className="bg-qty hover:bg-qty/90 text-sheet font-medium"
          >
            {progress ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Menyimpan {progress.done}/{progress.total}…
              </>
            ) : (
              `Terapkan ke ${perubahan.length} data`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
