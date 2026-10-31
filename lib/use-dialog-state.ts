import { useState } from "react";

/**
 * Status buka-tutup dialog yang bisa dikendalikan dari luar (misalnya dari menu Pengaturan)
 * atau dari tombol pemicunya sendiri. `onOpen` dijalankan setiap kali dialog berubah menjadi
 * terbuka, untuk mengisi nilai awal formulir.
 */
export function useDialogState(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
  onOpen?: () => void
) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;

  // Penyesuaian saat render (bukan effect): jalankan onOpen ketika dialog baru terbuka.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) onOpen?.();
  }

  const setIsOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return { isOpen, setIsOpen, controlled };
}
