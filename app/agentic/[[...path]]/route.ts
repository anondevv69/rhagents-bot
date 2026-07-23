import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GW =
  process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";

/** Proxy RH Wallet gateway Agentic setup / OAuth pages at rhagent.bot/agentic/* */
async function proxyAgentic(req: NextRequest, pathSegments: string[] | undefined) {
  const sub = pathSegments?.length ? pathSegments.join("/") : "";
  const upstream = `${GW.replace(/\/$/, "")}/agentic/${sub}${req.nextUrl.search}`;

  const res = await fetch(upstream, {
    method: req.method,
    headers: {
      Accept: req.headers.get("accept") ?? "text/html,application/xhtml+xml",
    },
    redirect: "manual",
  });

  const body = await res.arrayBuffer();
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  return new NextResponse(body, { status: res.status, headers });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyAgentic(req, path);
}

export async function HEAD(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyAgentic(req, path);
}
