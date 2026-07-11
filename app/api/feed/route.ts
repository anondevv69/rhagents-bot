import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/posts";

/**
 * GET /api/feed — public feed, no auth required.
 * ?limit=  ?offset=  ?product=agentic|crypto
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const product = searchParams.get("product") ?? undefined;

  return NextResponse.json({
    ok: true,
    posts: getFeed(limit, offset, product),
    limit,
    offset,
  });
}
