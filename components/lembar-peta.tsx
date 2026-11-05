import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Elemen visual tema "Lembar Peta × Mahakam".
 * Aturan warna: status "terisi" HANYA memakai warna --done (bar terisi, kotak terisi,
 * kotak status di tabel). Bagian kosong = "belum terisi". Grafik jumlah memakai --qty.
 */

// Perkiraan bujur/lintang wilayah Kalimantan Timur untuk tanda tepi bingkai
const LON = ["114°BT", "115°", "116°", "117°", "118°", "119°BT"];
const LAT = ["2°LU", "1°", "0°", "1°", "2°LS"];

/** Bingkai lembar peta (neatline) dengan tanda koordinat di tepinya. */
export function Neatline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative border border-ink p-[5px] md:mx-4", className)}>
      <div className="border-2 border-ink bg-sheet bg-graticule">{children}</div>
      <div aria-hidden="true" className="hidden md:block">
        {LON.map((label, i) => {
          const left = `${((i + 0.5) / LON.length) * 100}%`;
          return (
            <span key={`lon-${i}`}>
              <span className="absolute -top-2 h-[7px] w-px bg-contour" style={{ left }} />
              <span className="absolute -top-5 -translate-x-1/2 font-cond text-[11px] text-contour whitespace-nowrap" style={{ left }}>
                {label}
              </span>
              <span className="absolute -bottom-2 h-[7px] w-px bg-contour" style={{ left }} />
            </span>
          );
        })}
        {LAT.map((label, i) => {
          const top = `${((i + 0.5) / LAT.length) * 100}%`;
          return (
            <span key={`lat-${i}`}>
              <span className="absolute -left-2 h-px w-[7px] bg-contour" style={{ top }} />
              <span className="absolute -left-4 -translate-x-full -translate-y-1/2 font-cond text-[11px] text-contour whitespace-nowrap" style={{ top }}>
                {label}
              </span>
              <span className="absolute -right-2 h-px w-[7px] bg-contour" style={{ top }} />
              <span className="absolute -right-4 translate-x-full -translate-y-1/2 font-cond text-[11px] text-contour whitespace-nowrap" style={{ top }}>
                {label}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Bar keterisian: kotak kosong selalu tampil penuh, lalu bagian terisi tumbuh dari kiri. */
export function FillBar({
  percent,
  size = "md",
  className,
  label,
  animate = true,
}: {
  percent: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Matikan untuk bar kecil di tabel, supaya hanya ada satu gerakan utama per halaman. */
  animate?: boolean;
  /** Teks untuk pembaca layar, mis. "135 dari 222 terisi" */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label ?? `${clamped}% terisi`}
      className={cn(
        "relative border border-ink bg-sheet",
        size === "sm" ? "h-2.5" : size === "lg" ? "h-5" : "h-3.5",
        className
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 bg-done", animate && "animate-bar-grow")} style={{ width: `${clamped}%` }} />
      {/* Garis skala tiap 25% */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, transparent calc(100% - 1px), color-mix(in srgb, var(--ink) 45%, transparent) 0)",
          backgroundSize: "25% 100%",
        }}
      />
    </div>
  );
}

/** Angka skala di bawah FillBar besar. */
export function ScaleTicks() {
  return (
    <div aria-hidden="true" className="mt-1 flex justify-between text-[11px] text-ink-2 tabular-nums">
      <span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span>
    </div>
  );
}

/**
 * Satu kotak = satu daftar data. Semua kotak dirender kosong lebih dulu,
 * kemudian kotak terisi berubah warna berurutan dari kiri.
 */
export function UnitGrid({
  total,
  filled,
  columns: columnsProp,
  className,
}: {
  total: number;
  filled: number;
  /** Jumlah kolom; samakan antartahun agar ukuran kotak sebanding. */
  columns?: number;
  className?: string;
}) {
  // Bawaan: dua baris di layar lebar (maks. 120 kolom); di layar kecil selalu 37 kolom.
  const columns = columnsProp ?? Math.min(120, Math.max(1, Math.ceil(total / 2)));
  return (
    <div
      role="img"
      aria-label={`${filled} dari ${total} daftar data terisi`}
      className={cn(
        "grid gap-x-0.5 gap-y-[3px] [grid-template-columns:repeat(var(--cols),minmax(0,1fr))] max-md:[grid-template-columns:repeat(37,minmax(0,1fr))]",
        className
      )}
      style={{ "--cols": columns } as CSSProperties}
    >
      {Array.from({ length: total }, (_, i) =>
        i < filled ? (
          <i key={i} className="h-[18px] max-md:h-3.5 border border-done bg-done animate-unit-fill" style={{ "--i": i } as CSSProperties} />
        ) : (
          <i key={i} className="h-[18px] max-md:h-3.5 border border-ink/35 bg-sheet" />
        )
      )}
    </div>
  );
}

/** Kotak kecil penanda status: terisi (warna --done) atau belum terisi (kosong). */
export function Swatch({ filled, className, style }: { filled?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <i
      aria-hidden="true"
      className={cn("inline-block h-[11px] w-4 flex-none border border-ink", filled ? "bg-done" : "bg-sheet", className)}
      style={style}
    />
  );
}

/** Kunci warna yang diletakkan tepat di bawah elemen yang dijelaskan. */
export function StatusKey({ note }: { note?: string }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-ink-2">
      <span className="inline-flex items-center gap-[7px]"><Swatch filled />Terisi</span>
      <span className="inline-flex items-center gap-[7px]"><Swatch />Belum terisi</span>
      {note && <span>{note}</span>}
    </div>
  );
}

/** Status satu daftar data di tabel, memakai kotak yang sama dengan kunci warna. */
export function StatusLabel({ filled }: { filled: boolean }) {
  return filled ? (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink"><Swatch filled />Terisi</span>
  ) : (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-bound"><Swatch />Belum terisi</span>
  );
}

/** Judul halaman: judul rapat besar, satu kalimat penjelas, aksi di kanan. */
export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Baris keterangan kecil di bawah deskripsi (mis. waktu sinkronisasi terakhir). */
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <h1 className="font-cond text-[32px] font-[750] leading-[1.05] md:text-[40px]">{title}</h1>
        {description && <div className="mt-2 max-w-[70ch] text-ink-2">{description}</div>}
        {meta && <div className="mt-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export interface StatItem {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}

/** Deretan angka ringkasan dalam satu lembar bergaris (pengganti kartu-kartu KPI). */
export function StatStrip({ items, loading }: { items: StatItem[]; loading?: boolean }) {
  return (
    <dl className="mb-8 grid grid-cols-2 border-y-2 border-ink bg-sheet lg:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "px-4 py-4 sm:px-5",
            i % 2 === 1 && "border-l border-rule",
            i >= 2 && "border-t border-rule lg:border-t-0",
            i === 2 && "lg:border-l"
          )}
        >
          <dt className="text-sm text-ink-2">{item.label}</dt>
          <dd className="mt-1 font-cond text-[34px] font-[750] leading-none tabular-nums">
            {loading ? <SkeletonBlock className="mt-1 h-8 w-20" /> : <span className="block animate-reveal">{item.value}</span>}
          </dd>
          {item.note && (
            <dd className="mt-1.5 text-xs text-ink-2">
              {loading ? <SkeletonBlock className="h-3 w-3/4" /> : <span className="block animate-reveal">{item.note}</span>}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** Skeleton lokal (hindari import melingkar dengan components/ui). */
function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block animate-pulse bg-ink/10 motion-reduce:animate-none", className)} />;
}

/** Kelas bersama untuk kontrol filter (select, input) agar batasnya cukup kontras. */
export const controlClass =
  "h-9 border border-ink/40 bg-sheet px-3 text-sm text-ink outline-none transition-colors focus:border-qty focus:ring-2 focus:ring-qty/30";
