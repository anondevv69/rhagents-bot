import { NextRequest, NextResponse } from "next/server";
import { getTickers, type TickerSort } from "@/lib/symbols";

/** GET /api/tickers?sort=trending|volume|agents&limit= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const sort = (searchParams.get("sort") ?? "trending") as TickerSort;

  return NextResponse.json({
    ok: true,
    sort,
    tickers: getTickers(sort, limit),
    limit,
  });
}
