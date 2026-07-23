import { NextRequest, NextResponse } from "next/server";
import { redirectPath } from "@/lib/request-origin";
import { isPublicSharePath, isSocialCrawler } from "@/lib/social-crawlers";
import { CANONICAL_SITE_URL } from "@/lib/rhagent-setup";
import { isAppOnlyPath, isDocsHost, isDocsSitePath } from "@/lib/docs-host";

const VIEWER_COOKIE = "rhagents_viewer";

/** Human login / claim flows only — everything else needs a viewer cookie (or agent Bearer on gated APIs). */
const PUBLIC_PAGE_PREFIXES = [
  "/ia-preview-live",
  "/login",
  "/claim",
  "/certificates",
  "/terms",
  "/privacy",
  "/safety",
  "/post", // shared permalinks + OG (also matched by isPublicSharePath)
  "/agent",
  // Trading agent dashboard — auth is its own Telegram /website magic-link cookie, not the viewer gate.
  "/dashboard",
  "/discord",
  // Agentic OAuth setup wizard (proxied to RH Wallet gateway — public, no viewer cookie).
  "/agentic",
  "/docs",
];

/** SEO / social crawlers — must never redirect to login. */
const PUBLIC_METADATA_PATHS = new Set([
  "/opengraph-image",
  "/twitter-image",
  "/robots.txt",
  "/sitemap.xml",
  "/security.txt",
  "/.well-known/security.txt",
]);

/** Agent registration, login redemption, health — auth checked in route handlers. */
function isPublicApi(pathname: string): boolean {
  if (pathname === "/api/health") return true;
  if (pathname === "/api/auth/redeem-login-code") return true;
  // Trading dashboard — session checked in route handlers via rhagent_trading_session cookie.
  if (pathname.startsWith("/api/dashboard/")) return true;
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
  if (pathname.startsWith("/api/telegram/bridge")) return true;
  // Trading bot → partner wallet provisioning (auth: X-Telegram-Bridge-Secret in route handler).
  if (pathname.startsWith("/api/bankr/")) return true;
  if (pathname === "/api/discord/interactions") return true;
  // NFT portraits must be public — wallets / marketplaces fetch imageURI with no cookie
  if (pathname.startsWith("/api/nft/")) return true;
  if (pathname === "/api/ia-preview/snapshot") return true;
  // Feed reads — "Humans read" per SKILL.md, and agents curl these with no session, no bearer.
  if (pathname === "/api/feed" || pathname.startsWith("/api/post/")) return true;
  // Link-preview images for Discord / X / iMessage / Slack — must never 401.
  if (pathname.startsWith("/api/og/")) return true;
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
  const { pathname } = req.nextUrl;
  const fullPath = pathname + req.nextUrl.search;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", fullPath);

  if (isDocsHost(req)) {
    requestHeaders.set("x-docs-host", "1");

    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/docs";
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (isAppOnlyPath(pathname)) {
      return NextResponse.redirect(new URL(fullPath, CANONICAL_SITE_URL));
    }

    if (isDocsSitePath(pathname) || pathname.startsWith("/api/")) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    return NextResponse.redirect(new URL(fullPath, CANONICAL_SITE_URL));
  }

  if (process.env.VIEWER_GATE_ENABLED !== "true") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Canonical docs live on doc.rhagent.bot when configured separately from the app host.
  const docsBase = process.env.NEXT_PUBLIC_DOCS_URL?.replace(/\/$/, "");
  if (
    docsBase &&
    docsBase !== CANONICAL_SITE_URL &&
    (pathname === "/docs" || pathname.startsWith("/docs/"))
  ) {
    const dest =
      pathname === "/docs"
        ? `${docsBase}${req.nextUrl.hash}`
        : `${docsBase}${fullPath}${req.nextUrl.hash}`;
    return NextResponse.redirect(dest, 301);
  }

  // Public static assets (logo masks, hero, setup scripts, skill docs, etc.) — must not redirect to /login.
  // .md docs are how agents (curl, ClawdBot, Aeon, nanobot, ...) fetch the combined skill.md.
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|py|sh|md)$/i.test(pathname) || pathname.startsWith("/scripts/")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Agentic setup wizard — proxied at app/agentic/[[...path]]/route.ts (public, no viewer cookie).
  if (pathname === "/agentic" || pathname.startsWith("/agentic/")) {
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

  if (
    pathname === "/" ||
    pathname === "/feed" ||
    PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Shared post / agent links + their OG images — Discord/X/Slack unfurl without cookies.
  if (isPublicSharePath(pathname) || isSocialCrawler(req.headers.get("user-agent"))) {
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
