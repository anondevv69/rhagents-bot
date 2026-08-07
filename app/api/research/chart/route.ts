import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getChartSeries, getTokenMetrics } from "@/lib/market-research";
import { classifyChainSymbol } from "@/lib/chain-tokens";
import { classifySymbol } from "@/lib/symbol-catalog";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/research/chart?symbol=HOOD&interval=daily
 *
 * OHLC candles plus derived stats (SMA20/50, realized volatility, range) so
 * agents reason from the same arithmetic instead of each rolling their own.
 *
 * Chain tokens route to on-chain metrics instead of a candle provider — there is
 * no equity-style series for them, and returning a fabricated one would be worse
 * than saying so.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  const key = agent?.id ?? clientIp(req);
  // Provider quotas are the real constraint here — cap harder than other research routes.
  if (!rateLimit(`research-chart:${key}`, agent ? 60 : 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json(
      { ok: false, error: "symbol_required", message: "GET /api/research/chart?symbol=HOOD" },
      { status: 400 },
    );
  }
  const symbol = raw.toUpperCase().replace(/^\$/, "");
  const intervalParam = searchParams.get("interval") ?? "daily";
  const allowed = ["daily", "weekly", "60min", "15min", "5min"] as const;
  const interval = (allowed as readonly string[]).includes(intervalParam)
    ? (intervalParam as (typeof allowed)[number])
    : "daily";

  // On-chain token → no candle provider; hand back live flow metrics instead.
  const chain = classifyChainSymbol(symbol);
  if (chain?.contract) {
    const m = await getTokenMetrics(chain.contract);
    return NextResponse.json({
      ok: true,
      symbol: chain.symbol,
      kind: "onchain",
      chart: null,
      metrics: "error" in m ? null : m,
      note:
        "Robinhood Chain tokens have no OHLC series here — these are live flow metrics instead " +
        "(volume, liquidity, buy/sell counts). Use them for the same job: is there real demand, " +
        "and is the depth enough to act on.",
      full_metrics: `/api/research/token?contract=${chain.contract}`,
    });
  }

  const cls = classifySymbol(symbol);
  const isCrypto = cls?.product === "crypto";
  const series = await getChartSeries(symbol, { interval, crypto: isCrypto });

  if ("error" in series) {
    return NextResponse.json(
      { ok: false, symbol, ...series },
      { status: series.error === "rate_limited" ? 429 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    symbol,
    kind: isCrypto ? "crypto" : "equity",
    chart: series,
    read_it: [
      series.stats.sma_20 != null && series.stats.last != null
        ? `Last ${series.stats.last} vs SMA20 ${series.stats.sma_20} — ${series.stats.last > series.stats.sma_20 ? "above" : "below"} the short trend.`
        : null,
      series.stats.volatility_pct != null
        ? `Realized volatility ${series.stats.volatility_pct}% annualized — size any claim to that, not to the headline move.`
        : null,
      series.stats.change_pct != null
        ? `Window change ${series.stats.change_pct}% across ${series.candles.length} candles.`
        : null,
      "Cite the last candle date, not 'today' — the series is cached and may lag intraday.",
    ].filter(Boolean),
  });
}
