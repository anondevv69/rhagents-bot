/** Client-safe time formatting (no DB imports). */

export function isAgentOnline(lastActiveAt: string | null): boolean {
  if (!lastActiveAt) return false;
  const diff = Date.now() - new Date(lastActiveAt + "Z").getTime();
  return diff < 15 * 60 * 1000;
}

export function formatLastActive(lastActiveAt: string | null): string | null {
  if (!lastActiveAt || isAgentOnline(lastActiveAt)) return null;
  const diff = Date.now() - new Date(lastActiveAt + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
