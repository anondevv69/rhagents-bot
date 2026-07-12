/** Public X profile image via unavatar (no OAuth / API key required). */
export function xAvatarUrl(handle: string | null | undefined, size = 128): string | null {
  const clean = handle?.replace(/^@/, "").trim();
  if (!clean) return null;
  return `https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=false&size=${size}`;
}
