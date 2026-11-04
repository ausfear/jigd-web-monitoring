"use client";

import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Status login bersama untuk seluruh aplikasi (navbar, tombol sinkronisasi, dsb.).
 * Disimpan di tingkat modul, jadi komponen yang dipasang ulang langsung mendapat nilai
 * terakhir tanpa berkedip, dan Supabase Auth hanya dihubungi sekali.
 */
type AuthState = { user: User | null; loading: boolean };

let state: AuthState = { user: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  supabase.auth
    .getUser()
    .then(({ data: { user } }) => set({ user, loading: false }))
    .catch(() => set({ user: null, loading: false }));
  supabase.auth.onAuthStateChange((_event, session) => set({ user: session?.user ?? null, loading: false }));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: AuthState = { user: null, loading: true };

export function useAuthUser(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}
