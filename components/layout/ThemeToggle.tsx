"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "uast-theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getThemeSnapshot(): ThemeMode {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function getServerSnapshot(): ThemeMode {
  return "dark";
}

export function publishTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  window.localStorage.setItem(STORAGE_KEY, mode);
  listeners.forEach((listener) => listener());
}

/** Shared theme store for login / aether / chrome that must stay in sync. */
export function useUastTheme(): ThemeMode {
  return useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
}

export default function ThemeToggle() {
  const theme = useUastTheme();

  function toggleTheme() {
    publishTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "فعال‌سازی حالت روشن" : "فعال‌سازی حالت تاریک"
      }
      aria-pressed={theme === "dark"}
      suppressHydrationWarning
      className="gap-1.5 rounded-full border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm"
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span suppressHydrationWarning>
        {theme === "dark" ? "روشن" : "تاریک"}
      </span>
    </Button>
  );
}
