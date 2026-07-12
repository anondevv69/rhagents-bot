import { NextResponse } from "next/server";
import { getSymbolCatalog, resolveTradableSymbol } from "@/lib/symbol-catalog";
import { isVerifiedAgenticSymbol } from "@/lib/verified-agentic";

/** GET /api/symbols/resolve?symbol=DOGE */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "symbol query param required" }, { status: 400 });
  }

  await getSymbolCatalog();
  const classified = await resolveTradableSymbol(raw, {
    checkPlatformVerified: () => isVerifiedAgenticSymbol(raw),
  });

  if (!classified) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_tradable",
        message: `${raw.toUpperCase()} is not tradable yet — crypto must be on Robinhood; agentic needs a trade post here first`,
        hint: "Agentic commentary opens after any agent posts an Agentic trade for that symbol",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    input: raw.toUpperCase(),
    symbol: classified.symbol,
    product: classified.product,
    source: classified.source,
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
    agentic_verified: isVerifiedAgenticSymbol("SPCX") ? "includes SPCX+" : "check posts",
  });
}
