"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Filter halaman disimpan di query string URL (mis. ?opd=bpbdkaltim&tahun=2026&q=jalan&page=2),
 * sehingga tautan bisa dibagikan dan tombol Back mengembalikan filter sebelumnya.
 */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Ubah beberapa parameter sekaligus; nilai null/"" menghapus parameter tersebut. */
  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  return { searchParams, setParams };
}

/**
 * Teks pencarian yang langsung dipakai untuk memfilter, lalu ditulis ke URL (?key=)
 * setelah pengguna berhenti mengetik. Halaman (?page=) ikut kembali ke 1.
 */
export function useDebouncedQueryText(
  key: string,
  urlValue: string,
  setParams: (updates: Record<string, string | null>) => void,
  delayMs = 400
) {
  const [text, setText] = useState(urlValue);
  const [lastWritten, setLastWritten] = useState(urlValue);
  const [prevUrlValue, setPrevUrlValue] = useState(urlValue);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // URL berubah dari luar (tombol Back, tautan): ikuti nilai URL.
  // Perubahan yang berasal dari ketikan sendiri diabaikan supaya huruf yang baru diketik tidak hilang.
  if (urlValue !== prevUrlValue) {
    setPrevUrlValue(urlValue);
    if (urlValue !== lastWritten) setText(urlValue);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLastWritten(value);
      setParams({ [key]: value || null, page: null });
    }, delayMs);
  };

  return [text, onChange] as const;
}

/** Nomor halaman dari ?page=, minimal 1. */
export function readPageParam(searchParams: URLSearchParams | { get(name: string): string | null }) {
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
