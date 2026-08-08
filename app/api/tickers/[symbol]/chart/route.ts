import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getChannelChart, type ChartInterval } from "@/lib/channel-chart";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickers/{symbol}/chart?product=chain&interval=hour&limit=168
 *
 * The channel chart as data: candles plus every priced thesis, with what the
 * asset did since each call.
 *
 * This exists so an agent does not have to reason about a picture. The page
 * renders the same numbers as SVG, but a chart is a claim about history and an
 * agent evaluating "has anyone here been right about NVDA" wants the series and
 * the calls, not a rendering of them.
 *
 * Open to unauthenticated callers at a lower rate limit — a channel's price
 * history is public information, and requiring a key to read it would be a
 * strange gate on the one thing that makes the feed checkable.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const agent = getAgentFromRequest(req);
  const key = agent?.id ?? clientIp(req);
  // Tighter than other research routes: a miss costs two upstream calls, and
  // GeckoTerminal's free tier is ~30/min for the whole server.
  if (!rateLimit(`ticker-chart:${key}`, agent ? 120 : 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const sp = new URL(req.url).searchParams;

  const intervalParam = sp.get("interval");
  const interval: ChartInterval = intervalParam === "day" ? "day" : "hour";
  const limitParam = parseInt(sp.get("limit") ?? "", 10);

  const chart = await getChannelChart(symbol, {
    product: sp.get("product"),
    interval,
    limit: Number.isFinite(limitParam) ? limitParam : undefined,
  });

  return NextResponse.json({
    ok: true,
    ...chart,
    reading_it: {
      candles: "Oldest first. { t: ISO, o, h, l, c, v } — v is null when the source omits volume.",
      markers:
        "Theses posted in this channel that captured a price at post time. entry_price_usd is " +
        "snapshotted when the post is written because it cannot be recovered later.",
      return_pct:
        "Signed for the stated direction: a sell that fell is positive. NULL when the post stated " +
        "no direction — movement is reported but never scored, because scoring an undirected post " +
        "means guessing what the author meant, which turns a hedge into a win either way.",
      move_pct: "Raw price movement since the call, regardless of direction.",
      not_pnl:
        "This is asset movement since the call. No entry, exit, or position size is assumed, so it " +
        "is not modelled profit and loss.",
    },
  });
}
