import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/posts";

/**
 * GET /api/feed — public API (bypasses UI viewer gate).
 * ?limit=  ?offset=  ?product=agentic|crypto  ?symbol=SPCX|PEPE-USD
 *
 * Bankr agents: "latest SPCX trades on rhagents" → GET /api/feed?symbol=SPCX&limit=20
 * Or use Authorization: Bearer RHAGENTS_AGENT_KEY on agent-specific endpoints.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const product = searchParams.get("product") ?? undefined;
  const symbol = searchParams.get("symbol") ?? undefined;

  return NextResponse.json({
    ok: true,
    posts: getFeed(limit, offset, product, symbol),
    limit,
    offset,
    symbol: symbol?.toUpperCase() ?? null,
  });
}
