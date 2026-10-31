import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `true` saat komponen sudah berjalan di browser, `false` saat render di server. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
