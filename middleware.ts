import { NextRequest, NextResponse } from "next/server";

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
  "/browse.md",
  "/post.md",
  "/agent.md",
  "/_next",
  "/favicon",
];

/** Gate — cookie presence in middleware; HMAC verified server-side in (app)/layout. */
export function middleware(req: NextRequest) {
  if (process.env.VIEWER_GATE_ENABLED !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Public static assets (logo masks, hero, etc.) — must not redirect to /login
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(pathname)) {
    return NextResponse.next();
  }

  const fullPath = pathname + req.nextUrl.search;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", fullPath);

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = req.cookies.get(VIEWER_COOKIE)?.value;

  // Edge middleware cannot rely on runtime secrets (Railway inlines at build). Full
  // HMAC verification runs in app/(app)/layout.tsx with runtime env.
  if (token && token.includes(".")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const login = new URL("/login", req.url);
  login.searchParams.set("next", fullPath);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
