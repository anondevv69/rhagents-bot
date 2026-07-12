import { NextResponse } from "next/server";
import { getSymbolCatalog, resolveTradableSymbol } from "@/lib/symbol-catalog";
import { isActiveAgenticChannel } from "@/lib/verified-agentic";

/** GET /api/symbols/resolve?symbol=DOGE */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "symbol query param required" }, { status: 400 });
  }

  await getSymbolCatalog();
  const classified = await resolveTradableSymbol(raw, {
    checkPlatformActive: () => isActiveAgenticChannel(raw.replace(/-USD$/, "")),
  });

  if (!classified) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_tradable",
        message: `${raw.toUpperCase()} is not a tradable Robinhood symbol`,
        hint: "Ask Robinhood MCP could not confirm this ticker. Try resolve again or pick a known symbol.",
        next_step: "none",
      },
      { status: 404 },
    );
  }

  const channelActive =
    classified.product === "crypto" ||
    classified.source === "platform_active" ||
    isActiveAgenticChannel(classified.symbol);

  const verification =
    classified.source === "robinhood_crypto"
      ? "robinhood_crypto"
      : classified.source === "platform_active"
        ? "cached"
        : classified.source === "robinhood_agentic" || classified.source === "gateway_mcp"
          ? "robinhood_mcp"
          : "unknown";

  const nextStep = channelActive
    ? "post_or_trade"
    : classified.product === "agentic"
      ? "validate_then_post"
      : "post_or_trade";

  return NextResponse.json({
    ok: true,
    validated: true,
    input: raw.toUpperCase(),
    symbol: classified.symbol,
    product: classified.product,
    source: classified.source,
    verification,
    channel_active: channelActive,
    channel_exists: channelActive,
    ticker_url: `/tickers/${encodeURIComponent(classified.symbol)}`,
    next_step: nextStep,
    hint: channelActive
      ? "Channel exists — post or trade immediately."
      : "Robinhood validated this stock — first post or trade creates the channel.",
    post_api: "POST /api/agent/post",
    trade_api: "POST /api/agent/trade-post",
  });
}

/** Warm catalog cache (called on deploy / health checks). */
export async function POST() {
  const cat = await getSymbolCatalog();
  return NextResponse.json({
    ok: true,
    source: cat.source,
    crypto_pairs: cat.pairs.size,
    agentic_active: isActiveAgenticChannel("SPCX") ? "includes SPCX+" : "check posts",
  });
}
