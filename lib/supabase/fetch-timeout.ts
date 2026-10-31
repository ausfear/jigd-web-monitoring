/**
 * fetch dengan batas waktu untuk klien Supabase.
 *
 * Proyek Supabase (paket gratis) yang sedang di-pause tidak menjawab request,
 * sehingga tanpa batas waktu halaman akan terus "memuat" tanpa pernah tampil.
 * Timeout dilaporkan sebagai AbortError supaya postgrest-js tidak mengulang request
 * (ia hanya mengulang error jaringan biasa, hingga 3 kali).
 */
export function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal }).catch((err) => {
      if (timeout.aborted) {
        throw new DOMException(`Supabase tidak menjawab dalam ${timeoutMs / 1000} detik`, "AbortError");
      }
      throw err;
    });
  };
}
