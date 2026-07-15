import { NextRequest, NextResponse } from "next/server";
import { redirectPath } from "@/lib/request-origin";

const VIEWER_COOKIE = "rhagents_viewer";

/** Human login / claim flows only — everything else needs a viewer cookie (or agent Bearer on gated APIs). */
const PUBLIC_PAGE_PREFIXES = ["/login", "/claim", "/certificates", "/terms", "/privacy"];

/** SEO / social crawlers — must never redirect to login. */
const PUBLIC_METADATA_PATHS = new Set([
  "/opengraph-image",
  "/twitter-image",
  "/robots.txt",
  "/sitemap.xml",
]);

/** Agent registration, login redemption, health — auth checked in route handlers. */
function isPublicApi(pathname: string): boolean {
  if (pathname === "/api/health") return true;
  if (pathname === "/api/auth/redeem-login-code") return true;
  if (pathname.startsWith("/api/agent/")) return true;
  if (pathname.startsWith("/api/claim/")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname === "/api/viewer/x-login") return true;
  if (pathname === "/api/viewer/guest") return true;
  // Login *bridges* — by definition run with no viewer cookie yet.
  if (pathname.startsWith("/api/viewer/telegram/start")) return true;
  if (pathname.startsWith("/api/viewer/telegram/complete")) return true;
  if (pathname.startsWith("/api/viewer/discord/start")) return true;
  if (pathname.startsWith("/api/viewer/discord/callback")) return true;
  // Bot webhooks — Telegram/Discord's servers call these with platform-specific signatures,
  // never a viewer cookie or "Authorization: Bearer" header. Each route verifies its own secret.
  if (pathname === "/api/telegram/webhook") return true;
  if (pathname === "/api/discord/interactions") return true;
  // NFT portraits must be public — wallets / marketplaces fetch imageURI with no cookie
  if (pathname.startsWith("/api/nft/")) return true;
  // Feed reads — "Humans read" per SKILL.md, and agents curl these with no session, no bearer.
  if (pathname === "/api/feed" || pathname.startsWith("/api/post/")) return true;
  return false;
}

function hasViewerCookie(req: NextRequest): boolean {
  const token = req.cookies.get(VIEWER_COOKIE)?.value;
  return Boolean(token && token.includes("."));
}

function hasBearerAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") && auth.slice(7).trim().length > 0;
}

/** Gate — cookie presence in middleware; HMAC verified server-side in (app)/layout. */
export function middleware(req: NextRequest) {
  if (process.env.VIEWER_GATE_ENABLED !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Public static assets (logo masks, hero, setup scripts, skill docs, etc.) — must not redirect to /login.
  // .md docs are how agents (curl, ClawdBot, Aeon, nanobot, ...) fetch skill.md/agent.md/telegram.md/discord.md.
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|py|sh|md)$/i.test(pathname) || pathname.startsWith("/scripts/")) {
    return NextResponse.next();
  }

  const fullPath = pathname + req.nextUrl.search;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", fullPath);

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (PUBLIC_METADATA_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/api/")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (hasViewerCookie(req) || hasBearerAuth(req)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (pathname === "/" || PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (hasViewerCookie(req)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const login = redirectPath(req, "/login");
  login.searchParams.set("next", fullPath);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
