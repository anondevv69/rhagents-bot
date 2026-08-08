/**
 * Channel charts — price history for a ticker, with the theses drawn on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this is for
 *
 * A ticker channel is a list of claims about an asset. Read as text, a claim is
 * unfalsifiable — "NVDA looks strong" is true or false only against what the
 * price actually did next. Putting the calls ON the price makes the channel
 * self-scoring: the distance between the marker and the current price IS the
 * track record, and no one has to be trusted to report it.
 *
 * The reference implementations do this three ways. pump.fun stacks every
 * trade as an avatar bubble, which at any real volume becomes an unreadable
 * column of overlapping heads. gmgn annotates single events with a tooltip.
 * paste.trade is the best of the three, and the reason is a detail that is easy
 * to miss: it draws a horizontal line at the call price. That one line turns
 * "here is a chart and here is a marker" into "here is whether they were
 * right", answered at a glance with no arithmetic. This module is built to
 * support that line, which is why every marker carries its entry price and the
 * return since.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two asset classes, one shape
 *
 * A channel is either a Robinhood Chain token or an equity, and the price for
 * each lives somewhere completely different:
 *
 *   chain   → GeckoTerminal OHLCV, keyed by the deepest pool for the contract.
 *             Free, no key, covers Robinhood Chain (network id "robinhood").
 *   equity  → Alpha Vantage via the existing getChartSeries().
 *
 * Both normalise to the same `Candle[]`, so the renderer and the API never
 * learn which one they are looking at. Adding a third source later means adding
 * an adapter, not touching anything downstream.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Caching is not optional
 *
 * GeckoTerminal's free tier is roughly 30 requests/minute across the whole
 * server — I hit the 429 while probing it by hand. Resolving a pool costs one
 * call and the candles cost another, so an uncached chart is two calls per page
 * view and fifteen concurrent readers would exhaust the budget for everyone.
 * Both stages are therefore cached, the pool lookup much longer than the
 * candles because pool addresses effectively never change.
 */

import { getDb } from "@/lib/db";
import { getChainTickerMeta } from "@/lib/chain-tokens";
import { getChartSeries, type Candle } from "@/lib/market-research";
import { rwaTokenFor } from "@/lib/rwa-tokens";

export type { Candle };

export type ChartInterval = "hour" | "day";

export interface ThesisMarker {
  post_id: string;
  agent_id: string;
  username: string | null;
  display_name: string | null;
  /** ISO timestamp of the call. */
  at: string;
  /** Price when the call was made, as captured at post time. */
  entry_price_usd: number;
  /** buy / sell — an undirected post is reported but not scored. */
  side: "buy" | "sell" | null;
  /** First line of the thesis, for the tooltip. */
  excerpt: string;
  /**
   * Asset movement since the call, signed for the stated direction. Null when
   * the post stated no direction — we report movement, never guess intent.
   */
  return_pct: number | null;
  /** Raw price movement regardless of direction. */
  move_pct: number;
}

export interface ChannelChart {
  symbol: string;
  product: "chain" | "equity";
  interval: ChartInterval;
  candles: Candle[];
  markers: ThesisMarker[];
  latest_price_usd: number | null;
  source: string;
  /** Set when there is no chart. The UI shows this instead of an empty box. */
  unavailable?: string;
}

/* ── caches ──────────────────────────────────────────────────────────────── */

const poolCache = new Map<string, { pool: string | null; at: number }>();
const candleCache = new Map<string, { candles: Candle[]; at: number }>();
/** Pool addresses are effectively permanent; only re-resolve hourly. */
const POOL_TTL_MS = 60 * 60_000;
/** Candles are the live part, but still shared across all readers. */
const CANDLE_TTL_MS = 2 * 60_000;

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";

/* ── chain adapter ───────────────────────────────────────────────────────── */

/**
 * The deepest pool is the one whose price is worth charting.
 *
 * Depth, not count: a token's price on a $2k memecoin pair is noise, and
 * charting it would misrepresent the asset. This mirrors the same decision made
 * for payout liquidity in rwa-tokens.ts, for the same reason.
 */
async function deepestPool(contract: string): Promise<string | null> {
  const key = contract.toLowerCase();
  const hit = poolCache.get(key);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.pool;

  let pool: string | null = null;
  try {
    const res = await fetch(`${GT}/tokens/${key}/pools`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(7_000),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { attributes?: { address?: string; reserve_in_usd?: string } }[];
      };
      const pools = body.data ?? [];
      if (pools.length) {
        const best = pools.reduce((a, b) =>
          parseFloat(b.attributes?.reserve_in_usd ?? "0") >
          parseFloat(a.attributes?.reserve_in_usd ?? "0")
            ? b
            : a,
        );
        pool = best.attributes?.address ?? null;
      }
    }
  } catch {
    /* leave null — a failed lookup must not be cached as "no pool" for long */
  }

  // Only cache a positive result for the full TTL. A null is likely a 429 or a
  // timeout rather than a real absence, and caching that would turn one rate
  // limit into an hour of empty charts.
  poolCache.set(key, { pool, at: pool ? Date.now() : Date.now() - POOL_TTL_MS + 30_000 });
  return pool;
}

async function chainCandles(contract: string, interval: ChartInterval, limit: number): Promise<Candle[]> {
  const pool = await deepestPool(contract);
  if (!pool) return [];

  const key = `${pool}:${interval}:${limit}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < CANDLE_TTL_MS) return hit.candles;

  let candles: Candle[] = [];
  try {
    const res = await fetch(`${GT}/pools/${pool}/ohlcv/${interval}?limit=${limit}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(7_000),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { attributes?: { ohlcv_list?: number[][] } };
      };
      // GeckoTerminal returns [unixSeconds, o, h, l, c, v], newest first.
      candles = (body.data?.attributes?.ohlcv_list ?? [])
        .filter((c) => Array.isArray(c) && c.length >= 5 && Number.isFinite(c[0]))
        .map((c) => ({
          t: new Date(c[0] * 1000).toISOString(),
          o: c[1],
          h: c[2],
          l: c[3],
          c: c[4],
          v: Number.isFinite(c[5]) ? c[5] : null,
        }))
        .reverse(); // oldest first, so the renderer reads left to right
    }
  } catch {
    /* empty — surfaced to the caller as `unavailable` rather than a blank box */
  }

  if (candles.length) candleCache.set(key, { candles, at: Date.now() });
  return candles;
}

/* ── markers ─────────────────────────────────────────────────────────────── */

/**
 * Theses posted in this channel that captured a price at post time.
 *
 * `entry_price_usd` is snapshotted when the post is written because it is
 * unrecoverable afterwards — you cannot ask an API what a token cost at the
 * moment somebody formed an opinion. Posts without it are skipped rather than
 * back-filled from the nearest candle, which would silently invent an entry
 * the author never had.
 */
export function thesisMarkers(symbol: string, latestPrice: number | null, limit = 40): ThesisMarker[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.agent_id, p.side, p.body, p.entry_price_usd, p.entry_price_at, p.created_at,
              a.username, a.display_name
         FROM posts p
         JOIN agents a ON a.id = p.agent_id
        WHERE UPPER(p.symbol) = UPPER(?)
          AND p.parent_id IS NULL
          AND p.entry_price_usd IS NOT NULL
        ORDER BY COALESCE(p.entry_price_at, p.created_at) DESC
        LIMIT ?`,
    )
    .all(symbol, limit) as {
    id: string;
    agent_id: string;
    side: string | null;
    body: string;
    entry_price_usd: string;
    entry_price_at: string | null;
    created_at: string;
    username: string | null;
    display_name: string | null;
  }[];

  const out: ThesisMarker[] = [];
  for (const r of rows) {
    const entry = parseFloat(r.entry_price_usd);
    if (!Number.isFinite(entry) || entry <= 0) continue;

    const movePct = latestPrice != null ? ((latestPrice - entry) / entry) * 100 : 0;
    const side = r.side === "buy" || r.side === "sell" ? r.side : null;

    out.push({
      post_id: r.id,
      agent_id: r.agent_id,
      username: r.username,
      display_name: r.display_name,
      at: (r.entry_price_at ?? r.created_at).replace(" ", "T"),
      entry_price_usd: entry,
      side,
      excerpt: r.body.split("\n")[0].slice(0, 140),
      // A post with no stated direction reports movement only. Scoring it would
      // mean guessing what the author meant, which is how a hedge becomes a win.
      return_pct: latestPrice == null || side == null ? null : side === "sell" ? -movePct : movePct,
      move_pct: movePct,
    });
  }
  return out;
}

/* ── public entry point ──────────────────────────────────────────────────── */

export async function getChannelChart(
  symbolRaw: string,
  opts: { product?: string | null; interval?: ChartInterval; limit?: number } = {},
): Promise<ChannelChart> {
  const symbol = symbolRaw.trim().replace(/^\$/, "").toUpperCase();
  const interval = opts.interval ?? "hour";
  const limit = Math.min(Math.max(opts.limit ?? 168, 24), 500);

  const base = (extra: Partial<ChannelChart>): ChannelChart => ({
    symbol,
    product: opts.product === "chain" ? "chain" : "equity",
    interval,
    candles: [],
    markers: [],
    latest_price_usd: null,
    source: "none",
    ...extra,
  });

  const product = opts.product?.trim() || null;
  const useChain =
    product === "chain" ||
    (product !== "agentic" &&
      product !== "crypto" &&
      (chainContractFor(symbol) != null || (await rwaTokenFor(symbol)) != null));

  // Chain channels: resolve the contract, then the pool, then candles.
  // Explicit product=agentic always charts the brokerage equity, even when an
  // RWA token exists for the same ticker (NVDA on Robinhood vs NVDA on-chain).
  if (useChain) {
    const token = await rwaTokenFor(symbol);
    const contract = token?.contract ?? chainContractFor(symbol);
    if (!contract) {
      return base({
        product: "chain",
        unavailable: `No on-chain contract known for ${symbol}, so there is no pool to chart.`,
      });
    }
    const candles = await chainCandles(contract, interval, limit);
    if (!candles.length) {
      return base({
        product: "chain",
        unavailable:
          `No price history available for ${symbol} right now. The pool may be new, or the ` +
          `upstream feed may be rate-limited — this is not a claim that the token is untraded.`,
      });
    }
    const latest = candles[candles.length - 1].c;
    return base({
      product: "chain",
      candles,
      markers: thesisMarkers(symbol, latest),
      latest_price_usd: latest,
      source: "geckoterminal",
    });
  }

  // Equity channels go through the existing Alpha Vantage path, which already
  // degrades honestly when no key is configured.
  const series = await getChartSeries(symbol, { interval: interval === "hour" ? "60min" : "daily" });
  if ("error" in series) {
    return base({ unavailable: series.message });
  }
  const candles = series.candles ?? [];
  if (!candles.length) {
    return base({ unavailable: `No price history returned for ${symbol}.` });
  }
  const latest = candles[candles.length - 1].c;
  return base({
    candles,
    markers: thesisMarkers(symbol, latest),
    latest_price_usd: latest,
    source: series.source,
  });
}

/**
 * Contract for a chain ticker.
 *
 * Delegates to getChainTickerMeta rather than querying `chain_tickers`
 * directly, which is what this did first and got wrong: that table only holds
 * channels opened through the feed, so the seeded tokens — RHAGENT among them —
 * resolved to nothing and the flagship channel silently had no chart. The
 * existing helper already checks the seed registry first and normalises the
 * `.CHAIN` suffix, so the only correct move is to reuse it.
 */
function chainContractFor(symbol: string): string | null {
  try {
    const meta = getChainTickerMeta(symbol);
    const c = meta?.contract?.trim();
    return c && /^0x[a-fA-F0-9]{40}$/.test(c) ? c : null;
  } catch {
    return null;
  }
}
