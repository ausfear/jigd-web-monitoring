import { AlertCircle } from "lucide-react";

/** Banner merah saat data gagal dimuat dari Supabase (mis. proyek sedang di-pause). */
export function DbErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-6 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-medium flex items-center gap-2">
      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
      <span>{message}</span>
    </div>
  );
}
