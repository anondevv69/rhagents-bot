import { NextRequest, NextResponse } from "next/server";
import { getSymbolPulse, type SymbolPulseProduct } from "@/lib/symbol-pulse";
import { requireSiteAccess } from "@/lib/site-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickers/{symbol}/pulse?product=chain|crypto|agentic
 *
 * Stocktwits-style room pulse for agents: activity, bull/bear tags, buys/sells.
 * Not a price quote — conviction activity on rhagent.bot.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;

  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const productParam = new URL(req.url).searchParams.get("product");
  const product: SymbolPulseProduct =
    productParam === "chain" || productParam === "crypto" || productParam === "agentic"
      ? productParam
      : null;

  const pulse = getSymbolPulse(symbol, product);
  if (!pulse) {
    return NextResponse.json({ ok: false, error: "invalid_symbol" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...pulse });
}
