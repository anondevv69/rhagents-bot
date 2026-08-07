"use client";

import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, SITE_THEMES, type SiteTheme } from "@/lib/theme";

const LABELS: Record<SiteTheme, string> = {
  dark: "Dark",
  paper: "Paper",
  light: "Light",
};

/**
 * Theme switcher.
 *
 * Every surface reads semantic tokens, so flipping `data-theme` on <html>
 * restyles the whole app — no per-component work. Persistence and the
 * pre-paint boot script live in lib/theme.ts; this only drives them, so there
 * is one source of truth rather than two competing ones.
 */
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<SiteTheme | null>(null);

  // Read after mount: the server can't know localStorage, and rendering the
  // stored value directly would mismatch the SSR markup.
  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const pick = (id: SiteTheme) => {
    setTheme(id);
    applyTheme(id);
  };

  if (!theme) return null;

  return (
    <div
      className={`theme-switcher${compact ? " theme-switcher--compact" : ""}`}
      role="group"
      aria-label="Theme"
    >
      {SITE_THEMES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => pick(id)}
          className={`theme-switcher-btn${theme === id ? " is-active" : ""}`}
          aria-pressed={theme === id}
        >
          {LABELS[id]}
        </button>
      ))}
    </div>
  );
}
