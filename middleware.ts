import { NextRequest, NextResponse } from "next/server";

const VIEWER_COOKIE = "rhagents_viewer";

/** Unauthenticated access — login/claim flows, agent API, agent docs. */
const PUBLIC_PREFIXES = [
  "/login",
  "/claim",
  "/docs",
  "/api",
  "/skill.md",
  "/agent.md",
  "/_next",
  "/favicon",
];

/** Lightweight gate — full session verify happens server-side on sensitive routes. */
export function middleware(req: NextRequest) {
  if (process.env.VIEWER_GATE_ENABLED !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(VIEWER_COOKIE)?.value;
  if (token && token.includes(".")) return NextResponse.next();

  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
