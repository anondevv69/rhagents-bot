"use client";

import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, type SiteTheme } from "@/lib/theme";

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Warm editorial surface — a sheet, to distinguish paper from dark. */
function PaperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3h8l4 4v14H6V3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 3v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Cycles dark ↔ paper (cream). The cold white "light" theme is retired.
 */
const ORDER: SiteTheme[] = ["dark", "paper"];
const NEXT_LABEL: Record<SiteTheme, string> = {
  dark: "Paper mode",
  paper: "Dark mode",
};

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<SiteTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
  }, [theme, ready]);

  function toggle() {
    setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]!);
  }

  const label = NEXT_LABEL[theme];

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      onClick={toggle}
      aria-label={`Switch to ${label.toLowerCase()}`}
      title={label}
    >
      {theme === "paper" ? <PaperIcon /> : <MoonIcon />}
    </button>
  );
}
