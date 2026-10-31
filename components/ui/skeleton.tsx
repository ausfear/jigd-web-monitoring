import { cn } from "@/lib/utils";

/** Kotak abu-abu berdenyut sebagai penanda tempat konten yang sedang dimuat. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800", className)}
      {...props}
    />
  );
}

/** Kerangka baris tabel/daftar selama data dimuat. */
function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-slate-100 dark:divide-slate-800", className)} role="status" aria-label="Memuat data">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="hidden md:block h-3.5 w-24" />
          <Skeleton className="hidden md:block h-3.5 w-32" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Memuat data…</span>
    </div>
  );
}

export { Skeleton, SkeletonRows };
