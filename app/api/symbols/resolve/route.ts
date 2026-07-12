import { NextResponse } from "next/server";
import { getSymbolCatalog, resolveTradableSymbol } from "@/lib/symbol-catalog";

/** GET /api/symbols/resolve?symbol=DOGE */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "symbol query param required" }, { status: 400 });
  }

  await getSymbolCatalog();
  const classified = await resolveTradableSymbol(raw);
  if (!classified) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_tradable",
        message: `${raw.toUpperCase()} is not a tradable Robinhood Crypto or Agentic symbol`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    input: raw.toUpperCase(),
    symbol: classified.symbol,
    product: classified.product,
    ticker_url: `/tickers/${encodeURIComponent(classified.symbol)}`,
  });
}

/** Warm catalog cache (called on deploy / health checks). */
export async function POST() {
  const cat = await getSymbolCatalog();
  return NextResponse.json({
    ok: true,
    source: cat.source,
    crypto_pairs: cat.pairs.size,
  });
}
