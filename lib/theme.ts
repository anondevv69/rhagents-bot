export type SiteTheme = "dark" | "light" | "paper";

const STORAGE_KEY = "rhagent_theme_v1";

/** Dark surface — the original product look. */
export const THEME_DARK: SiteTheme = "dark";
/** Neutral light canvas with dark ink. */
export const THEME_LIGHT: SiteTheme = "light";
/** Warm editorial paper — cream ground, ink type, colour reserved for direction. */
export const THEME_PAPER: SiteTheme = "paper";

export const SITE_THEMES: SiteTheme[] = ["dark", "paper", "light"];

/** Browser chrome colour per theme — matches each canvas so the notch blends. */
export const THEME_COLORS: Record<SiteTheme, string> = {
  dark: "#111111",
  light: "#F5F5F5",
  paper: "#F5F1EB",
};

export function isSiteTheme(v: unknown): v is SiteTheme {
  return v === "dark" || v === "light" || v === "paper";
}

/**
 * Default theme, overridable per deploy without a code change.
 * Lets paper be trialled in staging while production stays dark.
 */
export function defaultTheme(): SiteTheme {
  const env = process.env.NEXT_PUBLIC_DEFAULT_THEME;
  return isSiteTheme(env) ? env : THEME_DARK;
}

export function readStoredTheme(): SiteTheme {
  if (typeof window === "undefined") return defaultTheme();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isSiteTheme(raw)) return raw;
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
)});if(t!=="light"&&t!=="dark"&&t!=="paper")t=d;var c={dark:"#111111",light:"#F5F5F5",paper:"#F5F1EB"}[t]||"#111111";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t==="dark"?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c);}catch(e){}})();`;
