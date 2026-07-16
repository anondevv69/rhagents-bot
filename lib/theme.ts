export type SiteTheme = "dark" | "light";

const STORAGE_KEY = "rhagent_theme_v1";

/** Dark surface — default (matches current product look). */
export const THEME_DARK: SiteTheme = "dark";
/** Light canvas with dark ink — same neon CTAs as hood.markets. */
export const THEME_LIGHT: SiteTheme = "light";

export function readStoredTheme(): SiteTheme {
  if (typeof window === "undefined") return THEME_DARK;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return THEME_DARK;
}

export function applyTheme(theme: SiteTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === THEME_LIGHT ? "#F5F5F5" : "#111111");
  }
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
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t!=="light"&&t!=="dark")t="dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#F5F5F5":"#111111");}catch(e){}})();`;
