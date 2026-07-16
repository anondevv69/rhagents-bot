import { NextRequest, NextResponse } from "next/server";
import { getTickers, type TickerSort } from "@/lib/symbols";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/tickers?sort=trending|volume|agents&product=crypto|agentic|chain&limit= */
export async function GET(req: NextRequest) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(0, parseInt(searchParams.get("limit") ?? "50") || 50), 100);
  const sort = (searchParams.get("sort") ?? "trending") as TickerSort;
  const productParam = searchParams.get("product");
  const product =
    productParam === "agentic" || productParam === "crypto" || productParam === "chain"
      ? productParam
      : undefined;

  return NextResponse.json({
    ok: true,
    sort,
    product: product ?? "all",
    tickers: getTickers(sort, limit, product),
    limit,
  });
}
