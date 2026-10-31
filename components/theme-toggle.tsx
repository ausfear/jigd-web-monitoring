"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/lib/use-mounted";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        aria-label="Memuat tema"
        className="h-9 w-9 border-ink/30 bg-transparent text-ink-2"
        disabled
      >
        <span className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
      aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
      className="h-9 w-9 border-ink/30 bg-transparent text-ink hover:bg-ink/5 dark:bg-transparent dark:hover:bg-ink/10"
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
