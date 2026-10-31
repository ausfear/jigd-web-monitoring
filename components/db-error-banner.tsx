import { AlertCircle } from "lucide-react";

/** Banner merah saat data gagal dimuat dari Supabase (mis. proyek sedang di-pause). */
export function DbErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-6 flex items-center gap-2 border border-bound border-l-4 bg-sheet p-3.5 text-sm text-bound">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
