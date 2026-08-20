"use client";

import { useSyncExternalStore } from "react";
import {
  applyTheme,
  nextTheme,
  readTheme,
  serverTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";

const LABEL: Record<Theme, string> = {
  system: "Система",
  light: "Светлая",
  dark: "Тёмная",
};

const GLYPH: Record<Theme, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

/**
 * One button that cycles system → light → dark.
 *
 * `useSyncExternalStore` rather than an effect: the theme lives in
 * localStorage, which is exactly the "external store" this hook exists for. It
 * also gets the server render right on its own — the server cannot know the
 * preference, so it renders "Система" and React swaps in the real value on
 * hydration without complaining about a mismatch.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);
  const next = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      title={`Тема: ${LABEL[theme].toLowerCase()}. Переключить на «${LABEL[next].toLowerCase()}»`}
      aria-label={`Тема: ${LABEL[theme].toLowerCase()}. Переключить на «${LABEL[next].toLowerCase()}»`}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-dust transition-colors hover:text-chalk ${className}`}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {GLYPH[theme]}
      </span>
      <span className="hidden sm:inline">{LABEL[theme]}</span>
    </button>
  );
}
