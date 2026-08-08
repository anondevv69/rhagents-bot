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
import { getChartSeries, getYahooChartSeries, type Candle } from "@/lib/market-research";
import { rwaTokenFor } from "@/lib/rwa-tokens";

export type { Candle };

export type ChartInterval = "minute" | "hour" | "day";

/**
 * Windows, each with the candle granularity that suits it.
 *
 * Granularity is derived from the window rather than offered as a free choice,
 * and that is a data constraint, not a simplification. GeckoTerminal only
 * returns buckets that actually traded, so on a thin token — $RHAGENT turns
 * over a few hundred dollars a day — a 5-minute view is mostly empty and reads
 * as a broken chart rather than a detailed one. Pairing each window with a
 * granularity that produces roughly 100–300 populated candles keeps every view
 * legible on both a busy token and a quiet one.
 *
 * gmgn and pump.fun do the same thing; their timeframe buttons change the
 * bucket size, they are not filters over one fixed series.
 */
export const CHART_WINDOWS = {
  "1D": { interval: "minute" as ChartInterval, aggregate: 5, hours: 24, limit: 288 },
  "3D": { interval: "minute" as ChartInterval, aggregate: 15, hours: 72, limit: 288 },
  "7D": { interval: "hour" as ChartInterval, aggregate: 1, hours: 24 * 7, limit: 168 },
  "30D": { interval: "hour" as ChartInterval, aggregate: 4, hours: 24 * 30, limit: 180 },
  ALL: { interval: "day" as ChartInterval, aggregate: 1, hours: Infinity, limit: 365 },
} as const;

export type ChartWindow = keyof typeof CHART_WINDOWS;

export function isChartWindow(v: string | null | undefined): v is ChartWindow {
  return !!v && Object.prototype.hasOwnProperty.call(CHART_WINDOWS, v);
}

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
  /**
   * Circulating supply, when the token has a meaningful one.
   *
   * Present ONLY for chain-native tokens. Deliberately null for tokenised
   * equities: NVDA's on-chain FDV is about $3.9M — the wrapper's float, not
   * NVIDIA's ~$4T — so surfacing it as "market cap" would tell a reader a
   * mega-cap is a micro-cap. For a stock the share price already is the
   * intuitive number; for a memecoin it is not.
   */
  supply: number | null;
  /** Current market cap in USD. Same restriction as `supply`. */
  market_cap_usd: number | null;
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
        data?: {
          attributes?: { address?: string; reserve_in_usd?: string; name?: string };
          relationships?: { base_token?: { data?: { id?: string } } };
        }[];
      };

      // Our token must be the pool's BASE, or the OHLCV series describes the
      // other side of the pair.
      //
      // This was a live bug: NVDA's deepest pool is "USDG / NVDA", where NVDA is
      // the QUOTE — so the chart plotted USDG at $0.9995 and labelled it NVDA,
      // a $224 asset shown at a dollar. Picking purely by depth finds whichever
      // pool is biggest, not whichever one is about our token.
      const pools = (body.data ?? []).filter((p) =>
        (p.relationships?.base_token?.data?.id ?? "").toLowerCase().endsWith(key),
      );

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

/**
 * Candles for a contract, cached.
 *
 * Exported so the entry-price backfill can reuse the same fetch path and the
 * same cache. A second implementation would mean a second rate-limit budget
 * against GeckoTerminal's ~30 req/min, and two places for the bucket semantics
 * to drift apart.
 */
export async function candlesForContract(
  contract: string,
  interval: ChartInterval,
  limit: number,
  aggregate = 1,
): Promise<Candle[]> {
  return chainCandles(contract, interval, limit, aggregate);
}

async function chainCandles(
  contract: string,
  interval: ChartInterval,
  limit: number,
  aggregate = 1,
): Promise<Candle[]> {
  const pool = await deepestPool(contract);
  if (!pool) return [];

  const key = `${pool}:${interval}:${aggregate}:${limit}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < CANDLE_TTL_MS) return hit.candles;

  let candles: Candle[] = [];
  try {
    const res = await fetch(`${GT}/pools/${pool}/ohlcv/${interval}?aggregate=${aggregate}&limit=${limit}`, {
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


/* ── supply / market cap ─────────────────────────────────────────────────── */

const supplyCache = new Map<string, { supply: number | null; at: number }>();
const SUPPLY_TTL_MS = 10 * 60_000;

/**
 * Circulating supply, derived from Dexscreener's FDV and price.
 *
 * Supply is what turns a price into a market cap, and market cap is the number
 * a reader can actually reason about: `$0.0₆8813` says nothing about whether a
 * token is early, `$88K mcap` says everything.
 *
 * IMPORTANT — the historical caveat. This is TODAY's supply. Rendering a past
 * call as "said at $88K mcap" multiplies the entry price by it, which is exact
 * only while supply is constant. That holds for a fixed-supply token like
 * $RHAGENT and does NOT hold for anything that mints or burns. It is the reason
 * this is never applied to tokenised equities, whose supply moves continuously
 * as the issuer mints and redeems against custody.
 */
async function tokenSupply(contract: string): Promise<number | null> {
  const key = contract.toLowerCase();
  const hit = supplyCache.get(key);
  if (hit && Date.now() - hit.at < SUPPLY_TTL_MS) return hit.supply;

  let supply: number | null = null;
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/robinhood/${key}`, {
      signal: AbortSignal.timeout(7_000),
    });
    if (res.ok) {
      const pairs = (await res.json()) as {
        priceUsd?: string;
        fdv?: number;
        marketCap?: number;
        liquidity?: { usd?: number };
      }[];
      if (Array.isArray(pairs) && pairs.length) {
        const deepest = pairs.reduce((a, b) =>
          (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
        );
        const px = parseFloat(deepest.priceUsd ?? "");
        const cap = deepest.marketCap ?? deepest.fdv;
        if (Number.isFinite(px) && px > 0 && Number.isFinite(cap) && (cap as number) > 0) {
          supply = (cap as number) / px;
        }
      }
    }
  } catch {
    /* leave null — the UI falls back to price-only, never a guessed cap */
  }

  supplyCache.set(key, { supply, at: Date.now() });
  return supply;
}

/* ── markers ─────────────────────────────────────────────────────────────── */

/**
 * Force a timestamp to explicit UTC.
 *
 * This fixes a real misplacement bug. `entry_price_at` is written with
 * `toISOString()` and carries a `Z`, but a marker falls back to `created_at`
 * when no price was captured, and SQLite writes that as `2026-08-08 04:56:29` —
 * UTC in fact, but with nothing in the string that says so.
 *
 * `new Date("2026-08-08T04:56:29")` is parsed as LOCAL time by every JS engine,
 * per the spec: date-time forms without an offset are local, date-only forms
 * are UTC. So on the server (UTC) the marker was right and in a browser it slid
 * by the viewer's offset — four hours in New York, nine in Tokyo — putting
 * calls on the wrong candle and silently dropping any that fell outside the
 * window. Charts were subtly wrong per-reader, which is the worst kind of wrong.
 */
function asUtcIso(raw: string): string {
  const s = raw.trim().replace(" ", "T");
  // Already carries a zone (Z, +01:00, -0500) — leave it alone.
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`;
}

/**
 * Priced calls and executed trades on this channel.
 *
 * Research posts store `entry_price_usd` at compose time. Trade fills store
 * `price_usd` (the execution price) — same semantic for the chart, different
 * column because fills existed before entry capture was wired.
 */
export function thesisMarkers(symbol: string, latestPrice: number | null, limit = 40): ThesisMarker[] {
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.agent_id, p.type, p.side, p.body, p.price_usd,
              p.entry_price_usd, p.entry_price_at, p.created_at,
              a.username, a.display_name
         FROM posts p
         JOIN agents a ON a.id = p.agent_id
        WHERE UPPER(p.symbol) = UPPER(?)
          AND p.parent_id IS NULL
          AND (
            p.entry_price_usd IS NOT NULL
            OR (
              p.price_usd IS NOT NULL
              AND CAST(REPLACE(p.price_usd, ',', '') AS REAL) > 0
              AND p.type IN ('trade_fill', 'trade_intent')
            )
          )
        ORDER BY COALESCE(p.entry_price_at, p.created_at) DESC
        LIMIT ?`,
    )
    .all(symbol, limit) as {
    id: string;
    agent_id: string;
    type: string;
    side: string | null;
    body: string;
    price_usd: string | null;
    entry_price_usd: string | null;
    entry_price_at: string | null;
    created_at: string;
    username: string | null;
    display_name: string | null;
  }[];

  const out: ThesisMarker[] = [];
  for (const r of rows) {
    const entryRaw =
      r.entry_price_usd ??
      (r.type === "trade_fill" || r.type === "trade_intent" ? r.price_usd : null);
    const entry = entryRaw ? parseFloat(String(entryRaw).replace(/,/g, "")) : NaN;
    if (!Number.isFinite(entry) || entry <= 0) continue;

    const movePct = latestPrice != null ? ((latestPrice - entry) / entry) * 100 : 0;
    const side = r.side === "buy" || r.side === "sell" ? r.side : null;

    out.push({
      post_id: r.id,
      agent_id: r.agent_id,
      username: r.username,
      display_name: r.display_name,
      at: asUtcIso(r.entry_price_at ?? r.created_at),
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
  opts: {
    product?: string | null;
    interval?: ChartInterval;
    limit?: number;
    /**
     * Preferred: pass a window ("1D", "7D", "ALL") and let the granularity be
     * chosen for it. `interval`/`limit` remain for callers that need to pin an
     * exact series, such as the entry-price backfill.
     */
    window?: ChartWindow;
  } = {},
): Promise<ChannelChart> {
  const symbol = symbolRaw.trim().replace(/^\$/, "").toUpperCase();
  const win = opts.window ? CHART_WINDOWS[opts.window] : null;
  const interval = win?.interval ?? opts.interval ?? "hour";
  const aggregate = win?.aggregate ?? 1;
  const limit = win
    ? win.limit
    : Math.min(Math.max(opts.limit ?? 168, 24), 1000);

  const base = (extra: Partial<ChannelChart>): ChannelChart => ({
    symbol,
    product: opts.product === "chain" ? "chain" : "equity",
    interval,
    candles: [],
    markers: [],
    latest_price_usd: null,
    supply: null,
    market_cap_usd: null,
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
    const candles = await chainCandles(contract, interval, limit, aggregate);
    if (!candles.length) {
      return base({
        product: "chain",
        unavailable:
          `No price history available for ${symbol} right now. The pool may be new, or the ` +
          `upstream feed may be rate-limited — this is not a claim that the token is untraded.`,
      });
    }
    const latest = candles[candles.length - 1].c;

    // Market cap only for chain-native tokens. A tokenised equity's on-chain
    // cap is the wrapper's float, not the company's, and presenting it as
    // "market cap" would be actively misleading.
    const supply = token ? null : await tokenSupply(contract);

    return base({
      product: "chain",
      candles,
      markers: thesisMarkers(symbol, latest),
      latest_price_usd: latest,
      supply,
      market_cap_usd: supply != null ? supply * latest : null,
      source: "geckoterminal",
    });
  }

  // Equity channels: try the tokenised equity FIRST, Alpha Vantage second.
  //
  // Alpha Vantage's free tier is 25 requests per DAY. One equity ticker page
  // view spends one, so the quota dies within minutes of any real traffic and
  // every equity chart then shows "quota exhausted" for the rest of the day —
  // which is exactly what /tickers/HOOD?product=agentic was doing.
  //
  // Most of these tickers also exist as a tokenised equity on Robinhood Chain,
  // chartable through GeckoTerminal with no key and no daily cap. Measured
  // against RHJ's official quotes those track the underlying within ~0.5%, so
  // for a price chart they are the same asset. Using them first turns a
  // 25-a-day budget into an unmetered one.
  //
  // It is labelled, not silently substituted: `source` says which feed drew the
  // line, because "the tokenised price" and "the exchange price" are not the
  // same claim even when the numbers agree.
  const tokenised = await rwaTokenFor(symbol);
  if (tokenised) {
    const tCandles = await chainCandles(tokenised.contract, interval, limit, aggregate);
    if (tCandles.length) {
      const tLast = tCandles[tCandles.length - 1].c;
      return base({
        candles: tCandles,
        markers: thesisMarkers(symbol, tLast),
        latest_price_usd: tLast,
        // No market cap: this is the wrapper's float, not the company's.
        supply: null,
        market_cap_usd: null,
        source: "geckoterminal (tokenised equity)",
      });
    }
  }

  const isCrypto = product === "crypto";
  const avInterval = interval === "hour" ? ("60min" as const) : ("daily" as const);
  const yahooSymbol = isCrypto ? symbol.replace(/-USD$/i, "") : symbol;
  const yahooEnabled = process.env.RHAGENT_EQUITY_FALLBACK === "yahoo";

  type SeriesResult = Awaited<ReturnType<typeof getChartSeries>>;
  let series: SeriesResult | null = null;

  // When Yahoo is enabled, try it before Alpha Vantage. AV's free tier is 25/day
  // and already exhausted — hitting it first only surfaces its error message
  // before the fallback runs, and burns quota on the rare requests that slip
  // through before the cache warms.
  if (yahooEnabled) {
    const fb = await getYahooChartSeries(yahooSymbol, avInterval);
    if (!("error" in fb)) series = fb;
  }

  if (!series) {
    series = await getChartSeries(symbol, { interval: avInterval, crypto: isCrypto });
    if ("error" in series && yahooEnabled) {
      const fb = await getYahooChartSeries(yahooSymbol, avInterval);
      if (!("error" in fb)) series = fb;
    }
  }

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
