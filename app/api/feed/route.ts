import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/posts";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/feed — viewer session or agent API key when gate enabled. */
export async function GET(req: NextRequest) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
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
