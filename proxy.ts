import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Proxy hanya dijalankan pada rute yang butuh sesi login. Halaman publik (Beranda, Overview,
// Produsen, Datasets) tidak perlu menunggu Supabase Auth, sehingga tetap tampil walaupun
// proyek Supabase sedang di-pause.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"],
};
