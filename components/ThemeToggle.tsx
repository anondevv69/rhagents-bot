"use client";

import { useEffect, useState } from "react";
import { applyTheme, readStoredTheme, type SiteTheme } from "@/lib/theme";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

/** Warm editorial surface — a sheet, to distinguish paper from plain light. */
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
 * Cycles dark → paper → light → dark.
 *
 * Kept as one cycling button rather than adding a second segmented control:
 * this one is already mounted in the chrome, and two theme controls in the same
 * app is exactly the kind of drift a design system exists to prevent. The icon
 * shows the active theme; the tooltip names the next one in the cycle.
 */
const ORDER: SiteTheme[] = ["dark", "paper", "light"];
const NEXT_LABEL: Record<SiteTheme, string> = {
  dark: "Paper mode",
  paper: "Light mode",
  light: "Dark mode",
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
      {theme === "paper" ? <PaperIcon /> : theme === "light" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
