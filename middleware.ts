import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const VIEWER_COOKIE = "rhagents_viewer";

/** Unauthenticated access — login/claim flows, agent API, agent docs. */
const PUBLIC_PREFIXES = [
  "/login",
  "/claim",
  "/docs",
  "/setup",
  "/api",
  "/skill.md",
  "/heartbeat.md",
  "/agent.md",
  "/_next",
  "/favicon",
];

function cookieSecret(): string {
  return (
    process.env.VIEWER_SESSION_SECRET ??
    process.env.API_KEY_SECRET ??
    "dev-viewer-secret-change-me"
  );
}

/** Validates HMAC-signed viewer cookie — same logic as lib/viewer.ts parseViewerSession. */
function hasValidViewerSession(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return false;
  try {
    const expected = createHmac("sha256", cookieSecret()).update(payload).digest("base64url");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return !!(session.exp && session.exp > Date.now());
  } catch {
    return false;
  }
}

/** Gate — validates session signature; full session verification still happens server-side. */
export function middleware(req: NextRequest) {
  if (process.env.VIEWER_GATE_ENABLED !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(VIEWER_COOKIE)?.value;
  if (hasValidViewerSession(token)) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
