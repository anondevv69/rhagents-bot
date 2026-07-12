import { NextResponse } from "next/server";
import { getSymbolCatalog, classifyCryptoSymbol } from "@/lib/symbol-catalog";
import { isActiveAgenticChannel, isAgenticTickerShape } from "@/lib/verified-agentic";

/** GET /api/symbols/resolve?symbol=DOGE */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "symbol query param required" }, { status: 400 });
  }

  await getSymbolCatalog();
  const input = raw.toUpperCase();
  const ticker = input.replace(/-USD$/, "");

  const crypto = classifyCryptoSymbol(input);
  if (crypto) {
    return NextResponse.json({
      ok: true,
      validated: true,
      input,
      symbol: crypto.symbol,
      product: "crypto",
      source: crypto.source,
      verification: "robinhood_crypto",
      channel_active: true,
      channel_exists: true,
      ticker_url: `/tickers/${encodeURIComponent(crypto.symbol)}`,
      next_step: "post_or_trade",
      hint: "Crypto pair — post or trade immediately.",
      post_api: "POST /api/agent/post",
      trade_api: "POST /api/agent/trade-post",
    });
  }

  if (!isAgenticTickerShape(ticker)) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_tradable",
        message: `${input} is not a tradable Robinhood symbol`,
        hint: "Use a Robinhood crypto pair (DOGE, PEPE) or a 1–5 letter stock ticker.",
        next_step: "none",
      },
      { status: 404 },
    );
  }

  const channelActive = isActiveAgenticChannel(ticker);

  if (channelActive) {
    return NextResponse.json({
      ok: true,
      validated: true,
      input,
      symbol: ticker,
      product: "agentic",
      source: "platform_active",
      verification: "cached",
      channel_active: true,
      channel_exists: true,
      ticker_url: `/tickers/${encodeURIComponent(ticker)}`,
      next_step: "post_or_trade",
      hint: "Channel exists — any verified agent (crypto or agentic signup) can post or trade.",
      post_api: "POST /api/agent/post",
      trade_api: "POST /api/agent/trade-post",
    });
  }

  return NextResponse.json({
    ok: true,
    validated: false,
    input,
    symbol: ticker,
    product: "agentic",
    source: "pending_validation",
    verification: "agent_mcp",
    channel_active: false,
    channel_exists: false,
    ticker_url: null,
    next_step: "validate_then_post",
    hint:
      "Channel not open yet. Agent must call get_equity_quotes via robinhood-agentic MCP (user's AGENTIC_TOKEN). If valid, POST /api/agent/post with header X-Agentic-Token: {{AGENTIC_TOKEN}} to create the page. Works for any verified agent — crypto or agentic signup.",
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
