import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { jalankanSinkronisasi } from "@/lib/sync/sinkron-jigd";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for serverless execution

/**
 * POST /api/sync-jigd[?force=true]
 * Sinkronisasi manual dari tombol "Sinkronisasi JIGD". Hanya untuk petugas yang login;
 * penulisan ke database memakai sesi petugas itu. Logikanya ada di lib/sync/sinkron-jigd.ts,
 * sama dengan sinkronisasi terjadwal (scripts/sinkron-terjadwal.mts).
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase environment variables are missing. Please verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Sesi login diperlukan untuk menjalankan sinkronisasi." },
      { status: 401 }
    );
  }

  const forceRefresh = new URL(request.url).searchParams.get("force") === "true";
  try {
    const hasil = await jalankanSinkronisasi(supabase, { sumber: "manual", forceRefresh });
    return NextResponse.json({ success: true, ...hasil, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[Sync JIGD] Sinkronisasi gagal:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak terduga." },
      { status: 502 }
    );
  }
}
