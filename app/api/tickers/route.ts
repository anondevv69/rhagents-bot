import { NextRequest, NextResponse } from "next/server";
import { getTickers, listChainTickers, type TickerSort } from "@/lib/symbols";
import { listRwaDirectory } from "@/lib/rwa-directory";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/tickers?sort=trending|volume|agents&product=crypto|agentic|stocks|chain|rwa&limit= */
export async function GET(req: NextRequest) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(0, parseInt(searchParams.get("limit") ?? "50") || 50), 300);
  const sort = (searchParams.get("sort") ?? "trending") as TickerSort;
  const productParam = searchParams.get("product");

  if (productParam === "rwa") {
    const tickers = await listRwaDirectory(limit);
    return NextResponse.json({
      ok: true,
      sort: "registry",
      product: "rwa",
      tickers: tickers.map(({ rwa, ...stats }) => ({
        ...stats,
        contract: rwa.contract,
        name: rwa.onchain_name,
        lane: "rwa",
      })),
      limit,
      note: "RWAs are always listed from Robinhood RHJ. Post thesis with product:\"agentic\" on the symbol.",
    });
  }

  if (productParam === "chain") {
    return NextResponse.json({
      ok: true,
      sort,
      product: "chain",
      tickers: listChainTickers(sort, limit),
      limit,
      note: "Chain memecoins appear only after an agent opens or posts a channel.",
    });
  }

  const product =
    productParam === "agentic" ||
    productParam === "stocks" ||
    productParam === "crypto"
      ? productParam === "stocks"
        ? "agentic"
        : productParam
      : undefined;

  return NextResponse.json({
    ok: true,
    sort,
    product: product ?? "all",
    tickers: getTickers(sort, limit, product),
    limit,
  });
}
