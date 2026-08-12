export type SiteTheme = "dark" | "paper";

const STORAGE_KEY = "rhagent_theme_v1";

/** Dark surface — the original product look. */
export const THEME_DARK: SiteTheme = "dark";
/** Warm editorial paper — cream ground, ink type, colour reserved for direction. */
export const THEME_PAPER: SiteTheme = "paper";

/** @deprecated Removed — light was the cold white canvas; cream (paper) replaces it. */
export const THEME_LIGHT = THEME_PAPER;

export const SITE_THEMES: SiteTheme[] = ["dark", "paper"];

/** Browser chrome colour per theme — matches each canvas so the notch blends. */
export const THEME_COLORS: Record<SiteTheme, string> = {
  dark: "#111111",
  paper: "#F5F1EB",
};

export function isSiteTheme(v: unknown): v is SiteTheme {
  return v === "dark" || v === "paper";
}

/**
 * Default theme, overridable per deploy without a code change.
 * Lets paper be trialled in staging while production stays dark.
 */
export function defaultTheme(): SiteTheme {
  const env = process.env.NEXT_PUBLIC_DEFAULT_THEME;
  return isSiteTheme(env) ? env : THEME_DARK;
}

/** Map retired "light" storage values onto paper. */
function normalizeTheme(raw: string | null): SiteTheme | null {
  if (raw === "light") return THEME_PAPER;
  if (isSiteTheme(raw)) return raw;
  return null;
}

export function readStoredTheme(): SiteTheme {
  if (typeof window === "undefined") return defaultTheme();
  try {
    const mapped = normalizeTheme(localStorage.getItem(STORAGE_KEY));
    if (mapped) return mapped;
  } catch {
    /* ignore */
  }
  return defaultTheme();
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  // Paper is a light surface as far as form controls and scrollbars are concerned.
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function initTheme(): SiteTheme {
  const theme = readStoredTheme();
  applyTheme(theme);
  return theme;
}

/** Inline script for root layout — runs before paint to avoid FOUC. */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=${JSON.stringify(
  defaultTheme(),
)};var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t==="light")t="paper";if(t!=="dark"&&t!=="paper")t=d;var c={dark:"#111111",paper:"#F5F1EB"}[t]||"#111111";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t==="dark"?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c);}catch(e){}})();`;
