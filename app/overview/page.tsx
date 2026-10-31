"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { DbErrorBanner } from "@/components/db-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { Neatline, FillBar, ScaleTicks, UnitGrid, StatusKey, Swatch } from "@/components/lembar-peta";
import { supabase, fetchAllRows, DB_UNREACHABLE_MESSAGE } from "@/lib/supabase";
import { fetchTahunAktif, TAHUN_DEFAULT } from "@/lib/tahun";
import { CacheLayerGeoportal, DaftarData } from "@/types/database";

/** Warna kategori SRID: gradasi warna kuantitas (bukan warna status). */
const SRID_COLORS = ["var(--qty)", "var(--qty-2)", "var(--qty-3)", "var(--contour)", "var(--ink-2)"];

/** Ambil data statistik dari Supabase secara paralel (tidak menyentuh state React). */
function loadOverviewData() {
  return Promise.all([
    fetchAllRows<CacheLayerGeoportal>((from, to) =>
      supabase.from("cache_layer_geoportal").select("*").order("id_dataset").range(from, to)
    ),
    fetchAllRows<DaftarData>((from, to) =>
      supabase.from("daftar_data").select("*").order("id").range(from, to)
    ),
    fetchTahunAktif(),
  ]);
}

const percentOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function OverviewPage() {
  const [layers, setLayers] = useState<CacheLayerGeoportal[]>([]);
  const [daftarData, setDaftarData] = useState<DaftarData[]>([]);
  const [tahunAktif, setTahunAktif] = useState<number[]>(TAHUN_DEFAULT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(
    () =>
      loadOverviewData()
        .then(([layersRes, daftarRes, tahun]) => {
          if (!layersRes.error) setLayers(layersRes.data);
          if (!daftarRes.error) setDaftarData(daftarRes.data);
          setTahunAktif(tahun);
          setLoadError(layersRes.error || daftarRes.error ? DB_UNREACHABLE_MESSAGE : null);
        })
        .catch((err) => {
          console.error("Error loading overview analytics:", err);
          setLoadError(DB_UNREACHABLE_MESSAGE);
        })
        .finally(() => setIsLoading(false)),
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalLayers = layers.length;

  // Kemajuan per tahun aktif, tahun terbaru di atas
  const yearly = useMemo(
    () =>
      [...tahunAktif]
        .sort((a, b) => b - a)
        .map((year) => {
          const rows = daftarData.filter((d) => Array.isArray(d.tahun_berlaku) && d.tahun_berlaku.includes(year));
          return { year, rows, total: rows.length, filled: rows.filter((d) => d.status_keterisian).length };
        }),
    [daftarData, tahunAktif]
  );
  const latest = yearly[0] ?? { year: new Date().getFullYear(), rows: [], total: 0, filled: 0 };
  const olderYears = yearly.slice(1);

  // Ringkasan tahun terbaru (panel keterangan)
  const summary = useMemo(() => {
    const byOpd = new Map<string, { total: number; filled: number }>();
    latest.rows.forEach((d) => {
      if (!d.opd_id) return;
      const entry = byOpd.get(d.opd_id) ?? { total: 0, filled: 0 };
      entry.total += 1;
      if (d.status_keterisian) entry.filled += 1;
      byOpd.set(d.opd_id, entry);
    });
    return {
      opdCount: byOpd.size,
      opdComplete: [...byOpd.values()].filter((o) => o.total > 0 && o.filled === o.total).length,
      kugiCount: latest.rows.filter((d) => Boolean(d.kugi_id || d.kugi_nama_unsur)).length,
    };
  }, [latest.rows]);

  const latestPercent = percentOf(latest.filled, latest.total);

  const geometryData = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach((l) => {
      const g = l.geometry_type?.trim() || "Tidak diketahui";
      const name = g.toLowerCase() === "tidak diketahui" ? "Tidak diketahui" : g;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [layers]);
  const maxGeometry = geometryData[0]?.count ?? 1;

  const sridData = useMemo(() => {
    const counts: Record<string, number> = {};
    layers.forEach((l) => {
      let s = l.srid?.trim() || "Tidak diketahui";
      if (s.includes("4326") || s.toLowerCase().includes("wgs")) s = "EPSG:4326 (WGS 84)";
      else if (s.includes("32750")) s = "EPSG:32750 (UTM 50S)";
      else if (s.includes("32650")) s = "EPSG:32650 (UTM 50N)";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [layers]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar currentPage="overview" />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-10 pt-9 pb-16">
        <DbErrorBanner message={loadError} />

        <header className="md:mx-4">
          <h1 className="font-cond text-[32px] md:text-[40px] font-[750] leading-[1.05]">
            Keterisian data geospasial Kalimantan Timur
          </h1>
          <div className="mt-2 max-w-[64ch] text-ink-2">
            {isLoading ? (
              <Skeleton className="h-4 w-80 max-w-full" />
            ) : (
              <>
                {latest.total} daftar data {latest.year} dari {summary.opdCount} OPD, dicocokkan dengan{" "}
                {totalLayers} layer di Geoportal JIGD.
              </>
            )}
          </div>
        </header>

        <Neatline className="mt-10">
          <div className="grid md:grid-cols-[1fr_300px]">
            {/* Isi lembar */}
            <div className="order-2 md:order-1 px-[18px] py-[22px] md:px-8 md:py-7">
              <section>
                <h2 className="font-cond text-[21px] font-bold">Kemajuan per tahun</h2>
                <p className="mt-1 mb-4 text-sm text-ink-2">
                  Daftar data dihitung terisi bila sudah punya layer utama di Geoportal.
                </p>

                {isLoading ? (
                  <div aria-label="Memuat kemajuan per tahun">
                    <div className="grid grid-cols-[48px_1fr] md:grid-cols-[56px_1fr] items-center gap-4 py-2.5">
                      <Skeleton className="h-4 w-11" />
                      <Skeleton className="h-3.5 w-48" />
                    </div>
                    <div className="grid gap-[3px]">
                      <Skeleton className="h-[18px]" />
                      <Skeleton className="h-[18px] w-3/5" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[48px_1fr] md:grid-cols-[56px_1fr] items-baseline gap-4 py-2.5">
                      <b className="font-cond text-lg">{latest.year}</b>
                      <span className="text-sm text-ink-2 tabular-nums">
                        {latest.total > 0
                          ? `${latest.filled} dari ${latest.total} terisi (${latestPercent}%)`
                          : "Belum ada daftar data untuk tahun ini."}
                      </span>
                    </div>
                    {latest.total > 0 && <UnitGrid total={latest.total} filled={latest.filled} />}

                    {olderYears.map((y) => (
                      <div
                        key={y.year}
                        className="mt-2.5 grid grid-cols-[48px_1fr] md:grid-cols-[56px_1fr_150px] items-center gap-x-4 gap-y-1 border-t border-dashed border-rule pt-3"
                      >
                        <b className="font-cond text-lg">{y.year}</b>
                        {y.total > 0 ? (
                          <>
                            <FillBar percent={percentOf(y.filled, y.total)} size="lg" label={`${y.filled} dari ${y.total} terisi`} />
                            <span className="col-start-2 md:col-start-auto text-sm text-ink-2 tabular-nums">
                              {y.filled} dari {y.total} terisi
                            </span>
                          </>
                        ) : (
                          <span className="md:col-span-2 text-sm italic text-ink-2">Belum ada daftar data untuk tahun ini.</span>
                        )}
                      </div>
                    ))}

                    <StatusKey note={latest.total > 0 ? "Satu kotak = satu daftar data" : undefined} />
                  </>
                )}
              </section>

              <section className="mt-[30px] grid gap-7 border-t border-rule pt-[26px] md:grid-cols-2 md:gap-10">
                <div>
                  <h2 className="font-cond text-[21px] font-bold">Jenis geometri</h2>
                  <p className="mt-1 mb-4 text-sm text-ink-2">Jumlah layer di Geoportal menurut tipe geometri.</p>
                  {isLoading ? (
                    [85, 40, 12, 3].map((w) => (
                      <div key={w} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 py-[5px]">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                        <Skeleton className="ml-auto h-3.5 w-7" />
                      </div>
                    ))
                  ) : geometryData.length === 0 ? (
                    <p className="text-sm text-ink-2">Belum ada layer di cache. Jalankan Sinkronisasi GeoNode.</p>
                  ) : (
                    geometryData.map((g) => (
                      <div key={g.name} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 py-[5px] text-sm">
                        <span>{g.name}</span>
                        <span className="h-3.5 min-w-[3px] bg-qty" style={{ width: `${(g.count / maxGeometry) * 100}%` }} />
                        <span className="text-right tabular-nums">{g.count}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h2 className="font-cond text-[21px] font-bold">Sistem koordinat</h2>
                  <p className="mt-1 mb-4 text-sm text-ink-2">
                    Proporsi {isLoading ? "" : `${totalLayers} `}layer menurut SRID.
                  </p>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-[26px] w-full" />
                      <div className="mt-3 grid gap-2.5">
                        {[44, 52, 48].map((w) => (
                          <div key={w} className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5">
                            <Skeleton className="h-[11px] w-4" />
                            <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                            <Skeleton className="h-3.5 w-8" />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : sridData.length > 0 && (
                    <>
                      <div className="flex h-[26px] border border-ink">
                        {sridData.map((s, i) => (
                          <span
                            key={s.name}
                            title={s.name}
                            className="h-full [&+&]:border-l [&+&]:border-sheet"
                            style={{ width: `${(s.count / totalLayers) * 100}%`, background: SRID_COLORS[i % SRID_COLORS.length] }}
                          />
                        ))}
                      </div>
                      <ul className="mt-3 grid gap-1.5 text-sm">
                        {sridData.map((s, i) => (
                          <li key={s.name} className="grid grid-cols-[16px_1fr_auto] items-center gap-2.5">
                            <Swatch style={{ background: SRID_COLORS[i % SRID_COLORS.length] }} />
                            <span>{s.name}</span>
                            <b className="tabular-nums">{percentOf(s.count, totalLayers)}%</b>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </div>

            {/* Panel keterangan, seperti kolom keterangan di tepi lembar peta */}
            <aside className="order-1 md:order-2 border-b-2 md:border-b-0 md:border-l-2 border-ink bg-sheet px-6 py-[26px]">
              <h3 className="text-sm font-semibold text-ink-2">Keterisian {latest.year}</h3>
              {isLoading ? (
                <div className="mt-2" aria-label="Memuat ringkasan">
                  <Skeleton className="mb-3 h-14 w-24" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="mt-2 h-3 w-full opacity-60" />
                  <Skeleton className="mt-3 h-3.5 w-11/12" />
                  <Skeleton className="mt-1.5 h-3.5 w-2/3" />
                  <div className="mt-[22px] grid gap-3 border-t border-rule pt-[18px]">
                    {[60, 45, 52, 58].map((w) => (
                      <div key={w} className="flex items-center justify-between gap-3">
                        <Skeleton className="h-3.5" style={{ width: `${w}%` }} />
                        <Skeleton className="h-4 w-7" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-cond mt-1.5 mb-3 text-[56px] font-[750] leading-none tabular-nums">
                    {latestPercent}
                    <small className="text-[22px] font-medium text-ink-2">%</small>
                  </div>
                  <FillBar percent={latestPercent} label={`${latest.filled} dari ${latest.total} terisi`} />
                  <ScaleTicks />
                  <p className="mt-2.5 text-sm text-ink-2">
                    {latest.filled} daftar data sudah punya layer utama di Geoportal, {latest.total - latest.filled} belum.
                  </p>
                  <ul className="mt-[22px] grid gap-[9px] border-t border-rule pt-[18px] text-sm">
                    {[
                      ["OPD dengan daftar data", summary.opdCount],
                      ["OPD terisi penuh", summary.opdComplete],
                      ["Layer di Geoportal", totalLayers],
                      ["Daftar data ber-KUGI", summary.kugiCount],
                    ].map(([label, value]) => (
                      <li
                        key={label}
                        className="flex items-baseline gap-1.5 after:order-1 after:flex-1 after:-translate-y-1 after:border-b after:border-dotted after:border-ink-2 after:content-['']"
                      >
                        {label}
                        <b className="order-2 font-cond text-[17px] tabular-nums">{value}</b>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 grid gap-1 border-t border-rule pt-4 text-sm">
                    <Link href="/produsen" className="text-link hover:underline">Rincian per OPD</Link>
                    <Link href="/datasets" className="text-link hover:underline">Katalog layer Geoportal</Link>
                  </div>
                  <p className="mt-4 text-xs text-ink-2">
                    Sumber: daftar data {latest.year} dan cache layer Geoportal JIGD.
                  </p>
                </>
              )}
            </aside>
          </div>
        </Neatline>
      </main>

      <Footer />
    </div>
  );
}
