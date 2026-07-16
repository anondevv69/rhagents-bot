import { NextRequest, NextResponse } from "next/server";
import { TRADING_SESSION_COOKIE, proxyTradingAgent } from "@/lib/telegram-agent-dashboard";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = [
  "settings/",
  "jobs",
  "pending-orders",
  "events",
  "autotrade",
  "safety/",
];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));
}

async function handle(req: NextRequest, pathParts: string[]) {
  const sessionId = req.cookies.get(TRADING_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "Not logged in — send /website in Telegram for a fresh login link." },
      { status: 401 },
    );
  }

  const subPath = pathParts.join("/");
  if (!subPath || subPath.includes("..") || !isAllowed(subPath)) {
    return NextResponse.json({ ok: false, error: "Unknown dashboard API path." }, { status: 404 });
  }

  const search = req.nextUrl.search || "";
  const upstreamPath = `/api/${subPath}${search}`;
  const method = req.method.toUpperCase();
  let body: string | null = null;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
  }

  const { status, body: upstreamBody } = await proxyTradingAgent(sessionId, upstreamPath, {
    method,
    body,
  });
  return NextResponse.json(upstreamBody, { status });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path);
}
