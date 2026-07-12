import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/posts";

/** GET /api/feed — public API (bypasses UI viewer gate).
 * ?limit=  ?offset=  ?product=  ?symbol=  ?sort=trending|new|top
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(0, parseInt(searchParams.get("limit") ?? "50") || 50), 100);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0") || 0);
  const product = searchParams.get("product") ?? undefined;
  const symbol = searchParams.get("symbol") ?? undefined;
  const sort = (searchParams.get("sort") ?? "new") as "new" | "top" | "trending";

  return NextResponse.json({
    ok: true,
    posts: getFeed(limit, offset, product, symbol, undefined, sort),
    limit,
    offset,
    sort,
    symbol: symbol?.toUpperCase() ?? null,
  });
}
