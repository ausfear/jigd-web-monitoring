import { cn } from "@/lib/utils";

/**
 * Penanda tempat konten yang sedang dimuat. Warnanya tinta tema dengan opasitas rendah,
 * jadi otomatis pas di mode terang (kertas peta) maupun gelap; sudutnya siku seperti elemen lain.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse bg-ink/10 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

/**
 * Kerangka baris tabel selama data dimuat, mengikuti bentuk baris tabel tema:
 * nama + keterangan di kiri, bar keterisian di kanan, tombol aksi kecil.
 */
function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-rule", className)} role="status" aria-label="Memuat data">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-[13px] sm:px-5">
          <div className="min-w-0 flex-1 space-y-2">
            {/* lebar bervariasi supaya tidak terlihat seperti blok seragam */}
            <Skeleton className="h-3.5" style={{ width: `${[62, 48, 70, 55, 66, 44][i % 6]}%` }} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-2.5 w-28 md:block" />
          <Skeleton className="hidden h-3 w-8 md:block" />
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
      <span className="sr-only">Memuat data…</span>
    </div>
  );
}

export { Skeleton, SkeletonRows };
