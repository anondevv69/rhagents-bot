/** Public X profile image via unavatar (no OAuth / API key required). */
export function xAvatarUrl(handle: string | null | undefined, size = 128): string | null {
  const clean = handle?.replace(/^@/, "").trim();
  if (!clean) return null;
  return `https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=false&size=${size}`;
}

/** Telegram profile photo via unavatar. */
export function telegramAvatarUrl(username: string | null | undefined, size = 128): string | null {
  const clean = username?.replace(/^@/, "").trim();
  if (!clean) return null;
  return `https://unavatar.io/telegram/${encodeURIComponent(clean)}?fallback=false&size=${size}`;
}
