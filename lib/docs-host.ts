import type { NextRequest } from "next/server";

/** Hostname for the public docs subdomain (no viewer gate). */
export const DOCS_HOST = (process.env.DOCS_HOST ?? "docs.rhagent.bot").toLowerCase();

/** Previous docs hostname — kept as an alias during DNS migration. */
const LEGACY_DOCS_HOST = "doc.rhagent.bot";

export function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

/** Read the public Host header (first value when proxied). */
export function requestHost(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.split(",")[0]?.trim() ||
    "";
  return normalizeHost(raw);
}

function hostMatchesDocs(hostname: string, docsHost: string): boolean {
  return hostname === docsHost || hostname.startsWith(`${docsHost}:`);
}

export function isDocsHost(req: NextRequest): boolean {
  const host = requestHost(req);
  if (!host) return false;
  const docsHost = normalizeHost(DOCS_HOST);
  const legacyHost = normalizeHost(LEGACY_DOCS_HOST);
  return hostMatchesDocs(host, docsHost) || hostMatchesDocs(host, legacyHost);
}

/** App routes that should live on rhagent.bot, not the docs subdomain. */
export function isAppOnlyPath(pathname: string): boolean {
  return (
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/agents" ||
    pathname.startsWith("/agents/") ||
    pathname.startsWith("/agent/") ||
    pathname.startsWith("/discussions") ||
    pathname.startsWith("/tickers") ||
    pathname.startsWith("/symbol/") ||
    pathname.startsWith("/search") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname.startsWith("/post/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/claim/") ||
    pathname === "/certificates" ||
    pathname.startsWith("/certificates/") ||
    pathname.startsWith("/ia-preview-live") ||
    pathname.startsWith("/dashboard")
  );
}

/** Paths served on the docs subdomain without the viewer gate. */
export function isDocsSitePath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/docs" || pathname.startsWith("/docs/")) return true;
  if (pathname.endsWith(".md")) return true;
  if (pathname.startsWith("/scripts/")) return true;
  if (pathname === "/agentic" || pathname.startsWith("/agentic/")) return true;
  if (pathname === "/safety" || pathname === "/terms" || pathname === "/privacy") return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|py|sh)$/i.test(pathname)) return true;
  return false;
}
