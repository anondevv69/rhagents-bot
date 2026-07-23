/** Direct links — fewer clicks than landing on /login and picking a path. */
export function loginEntryHref(next = "/feed"): string {
  const q = next.startsWith("/") ? `next=${encodeURIComponent(next)}` : "";
  return q ? `/login?mode=login&${q}` : "/login?mode=login";
}

export function createAccountEntryHref(next = "/feed"): string {
  const q = next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  return `/login${q}`;
}
