/**
 * Research data for agents — the raw material a bagworker turns into a thesis.
 *
 * A research-only agent has no brokerage connection by definition, so it cannot
 * pull quotes from Robinhood itself. This module gives every agent, funded or
 * not, enough real market data to produce work worth paying for.
 *
 * Sources, and their honest limits:
 *   - Dexscreener (free, no key) — full on-chain metrics for any Robinhood Chain
 *     token: price, volume, liquidity, txn counts, FDV, pair age, price change.
 *     This is the strongest data we can hand an agent today.
 *   - Robinhood Chain RPC — token metadata and supply.
 *   - An optional equity provider (env-gated) — volume, earnings dates and
 *     fundamentals for stocks. Not configured by default; every response says
 *     plainly whether it was available rather than inventing numbers.
 *
 * Tokenized RWAs are the bridge between the two: an RWA token on Robinhood Chain
 * has on-chain metrics we can always read AND an underlying equity ticker. An
 * agent can research the on-chain side for free and reason about the divergence.
 */

import { createPublicClient, http, parseAbi, formatUnits, isAddress, getAddress } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";

const DEXSCREENER = "https://api.dexscreener.com/latest/dex/tokens";
const AV = "https://www.alphavantage.co/query";

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({ chain: robinhoodChain, transport: http(rpc) });
}

export interface TokenMetrics {
  contract: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  total_supply: string | null;
  price_usd: number | null;
  /** Rolling volume in USD. */
  volume: { h1: number | null; h6: number | null; h24: number | null };
  /** Percent change. */
  price_change: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  liquidity_usd: number | null;
  fdv: number | null;
  market_cap: number | null;
  txns_h24: { buys: number | null; sells: number | null };
  /** Buy/sell imbalance over 24h — >1 means more buys than sells. */
  buy_sell_ratio_h24: number | null;
  /** Volume as a multiple of liquidity — high values mean churn relative to depth. */
  volume_to_liquidity_h24: number | null;
  pair_created_at: string | null;
  pair_age_days: number | null;
  dex: string | null;
  pair_url: string | null;
  chain: string | null;
  source: "dexscreener" | "onchain_only";
  fetched_at: string;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

interface DexPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  txns?: Record<string, { buys?: number; sells?: number }>;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  baseToken?: { symbol?: string; name?: string };
}

/** Full on-chain metrics for a token. Free, no API key, works for any agent. */
export async function getTokenMetrics(contractRaw: string): Promise<TokenMetrics | { error: string; message: string }> {
  if (!isAddress(contractRaw)) {
    return { error: "invalid_contract", message: "contract must be a 0x address on Robinhood Chain." };
  }
  const contract = getAddress(contractRaw);

  // On-chain metadata first — this always works, even for a token with no market.
  let symbol: string | null = null;
  let name: string | null = null;
  let decimals: number | null = null;
  let totalSupply: string | null = null;
  try {
    const c = publicClient();
    const [s, n, d] = await Promise.all([
      c.readContract({ address: contract, abi: erc20Abi, functionName: "symbol" }).catch(() => null),
      c.readContract({ address: contract, abi: erc20Abi, functionName: "name" }).catch(() => null),
      c.readContract({ address: contract, abi: erc20Abi, functionName: "decimals" }).catch(() => null),
    ]);
    symbol = s ? String(s) : null;
    name = n ? String(n) : null;
    decimals = typeof d === "number" ? d : null;
    const supply = await c
      .readContract({ address: contract, abi: erc20Abi, functionName: "totalSupply" })
      .catch(() => null);
    if (supply != null && decimals != null) {
      totalSupply = formatUnits(supply as bigint, decimals);
    }
  } catch {
    /* RPC unavailable — market data below may still resolve */
  }

  let pair: DexPair | null = null;
  try {
    const res = await fetch(`${DEXSCREENER}/${contract.toLowerCase()}`, {
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = (await res.json()) as { pairs?: DexPair[] };
      const pairs = data.pairs ?? [];
      // Prefer Robinhood Chain, then deepest liquidity — a thin pair on another
      // chain would give an agent a misleading price for RH Chain trading.
      const ranked = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
      pair = ranked.find((p) => /robinhood/i.test(String(p.chainId ?? ""))) ?? ranked[0] ?? null;
    }
  } catch {
    /* fall through to onchain_only */
  }

  const liq = pair ? num(pair.liquidity?.usd) : null;
  const v24 = pair ? num(pair.volume?.h24) : null;
  const buys = pair ? num(pair.txns?.h24?.buys) : null;
  const sells = pair ? num(pair.txns?.h24?.sells) : null;
  const created = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt) : null;

  return {
    contract,
    symbol: symbol ?? pair?.baseToken?.symbol ?? null,
    name: name ?? pair?.baseToken?.name ?? null,
    decimals,
    total_supply: totalSupply,
    price_usd: pair ? num(pair.priceUsd) : null,
    volume: {
      h1: pair ? num(pair.volume?.h1) : null,
      h6: pair ? num(pair.volume?.h6) : null,
      h24: v24,
    },
    price_change: {
      m5: pair ? num(pair.priceChange?.m5) : null,
      h1: pair ? num(pair.priceChange?.h1) : null,
      h6: pair ? num(pair.priceChange?.h6) : null,
      h24: pair ? num(pair.priceChange?.h24) : null,
    },
    liquidity_usd: liq,
    fdv: pair ? num(pair.fdv) : null,
    market_cap: pair ? num(pair.marketCap) : null,
    txns_h24: { buys, sells },
    buy_sell_ratio_h24: buys != null && sells != null && sells > 0 ? +(buys / sells).toFixed(3) : null,
    volume_to_liquidity_h24: v24 != null && liq != null && liq > 0 ? +(v24 / liq).toFixed(3) : null,
    pair_created_at: created ? created.toISOString() : null,
    pair_age_days: created ? +((Date.now() - created.getTime()) / 86_400_000).toFixed(1) : null,
    dex: pair?.dexId ?? null,
    pair_url: pair?.url ?? null,
    chain: pair?.chainId ?? null,
    source: pair ? "dexscreener" : "onchain_only",
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Equity fundamentals (volume, earnings dates) via an optional provider.
 *
 * Deliberately returns an explicit "unavailable" rather than throwing or faking:
 * an agent writing a thesis needs to know the difference between "volume was
 * low" and "we could not read volume". Set EQUITY_DATA_PROVIDER +
 * EQUITY_DATA_API_KEY to turn this on.
 */
export interface EquitySnapshot {
  symbol: string;
  available: boolean;
  provider: string | null;
  price_usd?: number | null;
  volume?: number | null;
  avg_volume?: number | null;
  market_cap?: number | null;
  pe_ratio?: number | null;
  next_earnings_date?: string | null;
  /** Provider-specific extras — sector, 52wk range, analyst target, etc. */
  extra?: Record<string, unknown>;
  note: string;
  alternatives?: string[];
}

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number | null;
}

export interface ChartSeries {
  symbol: string;
  interval: string;
  candles: Candle[];
  /** Derived read-outs so an agent doesn't have to recompute the basics. */
  stats: {
    first: number | null;
    last: number | null;
    high: number | null;
    low: number | null;
    change_pct: number | null;
    avg_volume: number | null;
    /** Simple moving averages over the returned window. */
    sma_20: number | null;
    sma_50: number | null;
    /** Annualized stdev of daily log returns, percent. */
    volatility_pct: number | null;
  };
  source: string;
  note: string;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(6);
}

function volatilityPct(closes: number[]): number | null {
  if (closes.length < 10) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1]! > 0 && closes[i]! > 0) rets.push(Math.log(closes[i]! / closes[i - 1]!));
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2);
}

function buildSeries(symbol: string, interval: string, candles: Candle[], source: string, note: string): ChartSeries {
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v).filter((v): v is number => v != null);
  const first = closes[0] ?? null;
  const last = closes[closes.length - 1] ?? null;
  return {
    symbol,
    interval,
    candles,
    stats: {
      first,
      last,
      high: candles.length ? Math.max(...candles.map((c) => c.h)) : null,
      low: candles.length ? Math.min(...candles.map((c) => c.l)) : null,
      change_pct: first && last && first > 0 ? +(((last - first) / first) * 100).toFixed(2) : null,
      avg_volume: vols.length ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length) : null,
      sma_20: sma(closes, 20),
      sma_50: sma(closes, 50),
      volatility_pct: volatilityPct(closes),
    },
    source,
    note,
  };
}

/**
 * OHLC candles for an equity or crypto symbol, via Alpha Vantage.
 *
 * Returns derived stats (SMA, realized volatility, range) alongside the raw
 * series so an agent can reason without reimplementing the arithmetic — and so
 * two agents citing "the 50-day" mean the same thing.
 */

/* ── response cache ──────────────────────────────────────────────────────── */

/**
 * Alpha Vantage's free tier is 25 requests per DAY, and until now nothing here
 * was cached — every page view and every agent call spent one. The quota died
 * within minutes of traffic and every equity chart showed "quota exhausted"
 * for the rest of the day.
 *
 * Worse, the success message already told agents "Cached up to 1h for
 * daily/weekly, 5m intraday". That was a claim about behaviour that did not
 * exist. This makes it true.
 *
 * TTLs follow how fast the underlying actually moves: a daily candle changes
 * once a day, so caching it for an hour costs nothing in accuracy and turns
 * 25 requests/day into 25 distinct symbol-intervals per hour.
 */
const avCache = new Map<string, { at: number; value: unknown }>();

function avCacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = avCache.get(key);
  if (!hit || Date.now() - hit.at > ttlMs) return null;
  return hit.value as T;
}

function avCacheSet(key: string, value: unknown): void {
  // Never cache an error. A rate-limit response cached for an hour would keep
  // the outage alive long after the quota reset.
  if (value && typeof value === "object" && "error" in (value as Record<string, unknown>)) return;
  avCache.set(key, { at: Date.now(), value });
}

export async function getChartSeries(
  symbolRaw: string,
  opts: { interval?: "daily" | "weekly" | "60min" | "15min" | "5min"; crypto?: boolean } = {},
): Promise<ChartSeries | { error: string; message: string; alternatives?: string[] }> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/^\$/, "");
  const interval = opts.interval ?? "daily";
  const provider = process.env.EQUITY_DATA_PROVIDER?.trim();
  const apiKey = process.env.EQUITY_DATA_API_KEY?.trim();

  // Intraday moves within the hour; a daily candle does not.
  const ttlMs = interval === "daily" || interval === "weekly" ? 60 * 60_000 : 5 * 60_000;
  const cacheKey = `chart:${symbol}:${interval}`;
  const cached = avCacheGet<ChartSeries>(cacheKey, ttlMs);
  if (cached) return cached;

  if (!apiKey || !(provider === "alphavantage" || provider === "alpha_vantage")) {
    return {
      error: "charts_unavailable",
      message:
        "No chart provider configured (set EQUITY_DATA_PROVIDER=alphavantage + EQUITY_DATA_API_KEY).",
      alternatives: [
        "On-chain tokens: GET /api/research/token?contract=0x… returns live volume, liquidity and flow with no provider needed.",
      ],
    };
  }

  const fn = opts.crypto
    ? "DIGITAL_CURRENCY_DAILY"
    : interval === "daily"
      ? "TIME_SERIES_DAILY"
      : interval === "weekly"
        ? "TIME_SERIES_WEEKLY"
        : "TIME_SERIES_INTRADAY";

  const params = new URLSearchParams({ function: fn, apikey: apiKey });
  if (opts.crypto) {
    params.set("symbol", symbol);
    params.set("market", "USD");
  } else {
    params.set("symbol", symbol);
    params.set("outputsize", "compact");
    if (fn === "TIME_SERIES_INTRADAY") params.set("interval", interval);
  }

  try {
    const res = await fetch(`${AV}?${params}`, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: interval === "daily" || interval === "weekly" ? 3600 : 300 },
    });
    if (!res.ok) return { error: "provider_error", message: `Alpha Vantage returned ${res.status}.` };
    const data = (await res.json()) as Record<string, unknown>;

    if (data.Note || data.Information) {
      return {
        error: "rate_limited",
        message:
          "Alpha Vantage quota exhausted for now — no candles this cycle. Do not infer price action you could not read.",
        alternatives: ["GET /api/research/token — on-chain metrics have no quota."],
      };
    }
    if (data["Error Message"]) {
      return { error: "invalid_symbol", message: `Alpha Vantage does not recognise "${symbol}".` };
    }

    const seriesKey = Object.keys(data).find((k) => /Time Series|Digital Currency/i.test(k));
    if (!seriesKey) return { error: "no_series", message: "No time series in the provider response." };

    const raw = data[seriesKey] as Record<string, Record<string, string>>;
    const candles: Candle[] = Object.entries(raw)
      .map(([t, v]) => {
        const pick = (suffix: string) => {
          const key = Object.keys(v).find((k) => k.toLowerCase().includes(suffix));
          return key ? parseFloat(v[key]!) : NaN;
        };
        return {
          t,
          o: pick("open"),
          h: pick("high"),
          l: pick("low"),
          c: pick("close"),
          v: Number.isFinite(pick("volume")) ? pick("volume") : null,
        };
      })
      .filter((c) => Number.isFinite(c.o) && Number.isFinite(c.c))
      .sort((a, b) => a.t.localeCompare(b.t));

    if (candles.length === 0) return { error: "no_candles", message: "Provider returned an empty series." };

    const built = buildSeries(
      symbol,
      interval,
      candles,
      "alphavantage",
      `${candles.length} candles. Cached up to 1h for daily/weekly, 5m intraday — cite the last candle date, not "now".`,
    );
    avCacheSet(cacheKey, built);
    return built;
  } catch {
    return { error: "provider_error", message: "Alpha Vantage did not respond in time." };
  }
}

/**
 * Fallback series for tickers with no tokenised equity.
 *
 * Yahoo's chart endpoint needs no key and has no daily cap, which is the only
 * reason it is here — it covers HOOD, PANW, TDG and everything else outside the
 * 96 RHJ tokens, all of which are otherwise dark once Alpha Vantage's 25/day is
 * spent.
 *
 * It is OFF by default and gated behind its own env var, because it is an
 * undocumented endpoint: no published terms for programmatic use, and it can
 * rate-limit or change shape without notice. That is a deliberate operator
 * choice rather than a default dependency, and the source is labelled so nobody
 * mistakes it for a contracted feed.
 */
export async function getYahooChartSeries(
  symbolRaw: string,
  interval: "daily" | "60min",
): Promise<ChartSeries | { error: string; message: string }> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/^\$/, "");
  const ttlMs = interval === "daily" ? 60 * 60_000 : 5 * 60_000;
  const cacheKey = `yahoo:${symbol}:${interval}`;
  const cached = avCacheGet<ChartSeries>(cacheKey, ttlMs);
  if (cached) return cached;

  const range = interval === "daily" ? "6mo" : "1mo";
  const gran = interval === "daily" ? "1d" : "1h";

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${gran}`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return { error: "provider_error", message: `Fallback provider returned ${res.status}.` };

    const body = (await res.json()) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }[] };
        }[];
      };
    };
    const r = body.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const q = r?.indicators?.quote?.[0];
    if (!ts.length || !q) return { error: "no_candles", message: `No series returned for ${symbol}.` };

    const candles: Candle[] = ts
      .map((t, i) => ({
        t: new Date(t * 1000).toISOString(),
        o: q.open?.[i] ?? NaN,
        h: q.high?.[i] ?? NaN,
        l: q.low?.[i] ?? NaN,
        c: q.close?.[i] ?? NaN,
        v: q.volume?.[i] ?? null,
      }))
      // Yahoo emits nulls for gaps and halts; a null close would break the scale.
      .filter((c) => Number.isFinite(c.o) && Number.isFinite(c.c));

    if (!candles.length) return { error: "no_candles", message: `No usable candles for ${symbol}.` };

    const built = buildSeries(
      symbol,
      interval,
      candles,
      "yahoo (unofficial)",
      `${candles.length} candles from an undocumented endpoint — usable, but not a contracted feed.`,
    );
    avCacheSet(cacheKey, built);
    return built;
  } catch {
    return { error: "provider_error", message: "Fallback provider did not respond in time." };
  }
}

/**
 * Just the last price, for scoring. Not a research call.
 *
 * getEquitySnapshot fires three Alpha Vantage requests (quote + fundamentals +
 * earnings) because a research agent wants all three. Scoring a thesis wants
 * exactly one number, and it wants it for every call an agent has ever made —
 * so routing that through the snapshot would spend three quota units per
 * symbol against a free tier of twenty-five per DAY, and a single track-record
 * read could exhaust the whole allowance.
 *
 * One GLOBAL_QUOTE, cached 5 minutes in the same process-level cache as
 * everything else here, so a track record covering the same ticker repeatedly
 * costs one request rather than one per post. Returns null rather than
 * throwing or guessing: an unscoreable call must read as unscored, never as
 * flat.
 */
export async function getEquityQuoteUsd(symbolRaw: string): Promise<number | null> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/^\$/, "");
  if (!symbol) return null;

  const provider = process.env.EQUITY_DATA_PROVIDER?.trim();
  const apiKey = process.env.EQUITY_DATA_API_KEY?.trim();
  if (!apiKey || !(provider === "alphavantage" || provider === "alpha_vantage")) return null;

  const cacheKey = `quote:${symbol}`;
  const cached = avCacheGet<number>(cacheKey, 300_000);
  if (cached != null) return cached;

  try {
    const res = await fetch(`${AV}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, Record<string, string>> & {
      Note?: string;
      Information?: string;
    };
    // Quota exhaustion arrives as HTTP 200 with a Note. Caching that would
    // extend the outage past its own reset, so bail before avCacheSet.
    if (data.Note || data.Information) return null;

    const price = num(data["Global Quote"]?.["05. price"]);
    if (price == null || !(price > 0)) return null;
    avCacheSet(cacheKey, price);
    return price;
  } catch {
    return null;
  }
}

export async function getEquitySnapshot(symbolRaw: string): Promise<EquitySnapshot> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/^\$/, "");
  const provider = process.env.EQUITY_DATA_PROVIDER?.trim() || null;
  const apiKey = process.env.EQUITY_DATA_API_KEY?.trim() || null;

  if (!provider || !apiKey) {
    return {
      symbol,
      available: false,
      provider: null,
      note:
        "No server-side equity data provider is configured, so rhagent.bot cannot give you " +
        "volume, fundamentals, or earnings dates for this symbol. Do not guess them in a thesis — " +
        "say what you could and could not verify.",
      alternatives: [
        "If you have a Robinhood connection, pull quotes from your own brokerage MCP (agent.robinhood.com/mcp/trading).",
        "If this symbol has a tokenized RWA on Robinhood Chain, use GET /api/research/token?contract=0x… — on-chain volume, liquidity and flow are always readable.",
        "Read what other agents have posted: GET /api/feed?symbol=" + symbol,
      ],
    };
  }

  // Alpha Vantage — covers quote, fundamentals AND the earnings calendar from one
  // key, which is the full set a research agent needs for an equity thesis.
  //
  // Rate limits are the real constraint, not correctness: the free tier is ~25
  // requests/day total. Every call below is cached hard (quote 5m, fundamentals
  // and earnings 12h) because a fleet of agents researching the same ticker
  // would otherwise burn the daily quota in minutes. Fundamentals barely move
  // intraday, so this costs nothing in accuracy.
  if (provider === "alphavantage" || provider === "alpha_vantage") {
    try {
      const [quoteRes, overviewRes, earningsRes] = await Promise.all([
        fetch(`${AV}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`, {
          signal: AbortSignal.timeout(9000),
          next: { revalidate: 300 },
        }),
        fetch(`${AV}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`, {
          signal: AbortSignal.timeout(9000),
          next: { revalidate: 43200 },
        }),
        fetch(`${AV}?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`, {
          signal: AbortSignal.timeout(9000),
          next: { revalidate: 43200 },
        }),
      ]);

      const quote = quoteRes.ok
        ? ((await quoteRes.json()) as Record<string, Record<string, string>> & { Note?: string; Information?: string })
        : null;
      const overview = overviewRes.ok ? ((await overviewRes.json()) as Record<string, string>) : null;
      const earnings = earningsRes.ok
        ? ((await earningsRes.json()) as { quarterlyEarnings?: { reportedDate?: string; fiscalDateEnding?: string }[] })
        : null;

      // Alpha Vantage returns HTTP 200 with a "Note"/"Information" body when the
      // quota is exhausted. Treating that as data would silently feed an agent
      // empty numbers, so surface it as unavailable instead.
      const throttled = quote?.Note || quote?.Information || overview?.Note || overview?.Information;
      if (throttled) {
        return {
          symbol,
          available: false,
          provider: "alphavantage",
          note:
            "Alpha Vantage rate limit reached — no data this cycle. Do NOT infer numbers; " +
            "say the fundamentals could not be verified, or use on-chain data instead.",
          alternatives: [`GET /api/research/token — on-chain metrics have no such quota.`],
        };
      }

      const g = quote?.["Global Quote"] ?? {};
      const price = num(g["05. price"]);
      const volume = num(g["06. volume"]);

      // AV gives past reported dates; the next one is inferred as the most recent
      // fiscal quarter that has no reported date yet.
      const quarters = earnings?.quarterlyEarnings ?? [];
      const nextEarnings =
        quarters.find((q) => !q.reportedDate && q.fiscalDateEnding)?.fiscalDateEnding ?? null;
      const lastReported = quarters.find((q) => q.reportedDate)?.reportedDate ?? null;

      if (price == null && !overview?.Symbol) {
        return {
          symbol,
          available: false,
          provider: "alphavantage",
          note: `Alpha Vantage returned nothing for "${symbol}" — check the ticker is valid and US-listed.`,
        };
      }

      return {
        symbol,
        available: true,
        provider: "alphavantage",
        price_usd: price,
        volume,
        avg_volume: num(overview?.["50DayMovingAverage"] ? overview?.["50DayMovingAverage"] : null),
        market_cap: num(overview?.MarketCapitalization),
        pe_ratio: num(overview?.PERatio),
        next_earnings_date: nextEarnings,
        extra: {
          name: overview?.Name ?? null,
          sector: overview?.Sector ?? null,
          industry: overview?.Industry ?? null,
          eps: num(overview?.EPS),
          beta: num(overview?.Beta),
          dividend_yield: num(overview?.DividendYield),
          week52_high: num(overview?.["52WeekHigh"]),
          week52_low: num(overview?.["52WeekLow"]),
          analyst_target: num(overview?.AnalystTargetPrice),
          change_percent: g["10. change percent"] ?? null,
          last_reported_earnings: lastReported,
        },
        note:
          "Live from Alpha Vantage. Fundamentals are cached up to 12h and quote up to 5m — " +
          "cite that in a time-sensitive thesis. Charts: GET /api/research/chart?symbol=" + symbol,
      };
    } catch {
      return {
        symbol,
        available: false,
        provider: "alphavantage",
        note: "Alpha Vantage did not respond. Do not guess numbers — say the data was unavailable.",
      };
    }
  }

  // Finnhub is the alternative implementation because its free tier covers both
  // quote and earnings calendar, which is exactly the pair an agent needs.
  if (provider === "finnhub") {
    try {
      const [quoteRes, metricRes, earningsRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`, {
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 60 },
        }),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`, {
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 3600 },
        }),
        fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${apiKey}`, {
          signal: AbortSignal.timeout(8000),
          next: { revalidate: 3600 },
        }),
      ]);
      const quote = quoteRes.ok ? ((await quoteRes.json()) as { c?: number }) : null;
      const metric = metricRes.ok
        ? ((await metricRes.json()) as { metric?: Record<string, number> })
        : null;
      const earnings = earningsRes.ok
        ? ((await earningsRes.json()) as { earningsCalendar?: { date?: string }[] })
        : null;

      const upcoming = (earnings?.earningsCalendar ?? [])
        .map((e) => e.date)
        .filter((d): d is string => !!d && new Date(d).getTime() >= Date.now() - 86_400_000)
        .sort()[0] ?? null;

      return {
        symbol,
        available: true,
        provider,
        price_usd: num(quote?.c),
        volume: num(metric?.metric?.["10DayAverageTradingVolume"]),
        avg_volume: num(metric?.metric?.["3MonthAverageTradingVolume"]),
        market_cap: num(metric?.metric?.["marketCapitalization"]),
        pe_ratio: num(metric?.metric?.["peBasicExclExtraTTM"]),
        next_earnings_date: upcoming,
        note: "Live equity data. Cite the fetch time in your thesis — these move.",
      };
    } catch {
      return {
        symbol,
        available: false,
        provider,
        note: `Equity provider "${provider}" is configured but did not respond. Do not guess numbers — say the data was unavailable.`,
      };
    }
  }

  return {
    symbol,
    available: false,
    provider,
    note: `Unknown EQUITY_DATA_PROVIDER "${provider}". Supported: finnhub.`,
  };
}

export interface OptionContract {
  contract_id: string | null;
  expiration: string | null;
  strike: number | null;
  type: "call" | "put" | null;
  last: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  open_interest: number | null;
  implied_volatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface OptionChain {
  symbol: string;
  date: string | null;
  contracts: OptionContract[];
  expirations: string[];
  /** Derived reads so agents reason from the same arithmetic. */
  stats: {
    total_volume: number | null;
    total_open_interest: number | null;
    put_call_volume_ratio: number | null;
    put_call_oi_ratio: number | null;
    atm_iv: number | null;
    max_pain_strike: number | null;
  };
  source: string;
  note: string;
}

/**
 * Options chain with greeks and IV.
 *
 * agents.md tells agents that "options and stock metrics" is one of the things
 * that sells here, so the platform owed them a way to actually get it — until
 * now `option_type`/`strike_price` existed only as fields on a post an agent
 * could describe, with no data source behind them.
 *
 * Alpha Vantage HISTORICAL_OPTIONS returns the full chain with greeks. Realtime
 * is a premium tier; the historical endpoint covers the previous session, which
 * is what most research is built on anyway. As everywhere else here, an
 * unavailable field says so instead of returning a plausible-looking zero.
 */
export async function getOptionChain(
  symbolRaw: string,
  opts: { date?: string } = {},
): Promise<OptionChain | { error: string; message: string; alternatives?: string[] }> {
  const symbol = symbolRaw.trim().toUpperCase().replace(/^\$/, "");
  const provider = process.env.EQUITY_DATA_PROVIDER?.trim();
  const apiKey = process.env.EQUITY_DATA_API_KEY?.trim();

  if (!apiKey || !(provider === "alphavantage" || provider === "alpha_vantage")) {
    return {
      error: "options_unavailable",
      message:
        "No options data provider configured (set EQUITY_DATA_PROVIDER=alphavantage + " +
        "EQUITY_DATA_API_KEY). Do not state strikes, IV or greeks you could not read.",
      alternatives: [
        "Connect Alpha Vantage's own MCP with your key for your own quota: https://mcp.alphavantage.co/mcp?apikey=YOUR_KEY",
        "On-chain flow needs no provider: GET /api/research/token",
      ],
    };
  }

  // An option chain is the most expensive thing we ask Alpha Vantage for — one
  // call can return hundreds of contracts, and the free tier is 25 requests a
  // DAY across every symbol and every function. This was the last AV path with
  // no process-level cache: `next: { revalidate }` only dedupes within Next's
  // own fetch cache, which a dynamic route with per-request search params does
  // not reliably share, so two agents asking about HOOD an hour apart spent two
  // of the day's twenty-five.
  //
  // A chain is keyed by symbol + session date and is immutable once that
  // session closes, so this is a safe thing to hold. 1h TTL matches the charts;
  // avCacheSet refuses to store errors, so a quota outage never gets extended
  // past its own reset.
  const cacheKey = `options:${symbol}:${opts.date ?? "latest"}`;
  const cached = avCacheGet<OptionChain>(cacheKey, 3600_000);
  if (cached) return cached;

  const params = new URLSearchParams({ function: "HISTORICAL_OPTIONS", symbol, apikey: apiKey });
  if (opts.date) params.set("date", opts.date);

  try {
    const res = await fetch(`${AV}?${params}`, {
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { error: "provider_error", message: `Alpha Vantage returned ${res.status}.` };
    const data = (await res.json()) as {
      data?: Record<string, string>[];
      message?: string;
      Note?: string;
      Information?: string;
      ["Error Message"]?: string;
    };

    if (data.Note || data.Information) {
      return {
        error: "rate_limited",
        message: "Alpha Vantage quota exhausted — no chain this cycle. Do not infer greeks you could not read.",
        alternatives: ["GET /api/research/token — on-chain metrics have no quota."],
      };
    }
    if (data["Error Message"] || !Array.isArray(data.data)) {
      return { error: "invalid_symbol", message: `No options chain available for "${symbol}".` };
    }

    const contracts: OptionContract[] = data.data.map((c) => ({
      contract_id: c.contractID ?? null,
      expiration: c.expiration ?? null,
      strike: num(c.strike),
      type: c.type === "call" || c.type === "put" ? c.type : null,
      last: num(c.last),
      bid: num(c.bid),
      ask: num(c.ask),
      volume: num(c.volume),
      open_interest: num(c.open_interest),
      implied_volatility: num(c.implied_volatility),
      delta: num(c.delta),
      gamma: num(c.gamma),
      theta: num(c.theta),
      vega: num(c.vega),
    }));

    if (contracts.length === 0) {
      return { error: "no_contracts", message: `Chain for ${symbol} came back empty.` };
    }

    const calls = contracts.filter((c) => c.type === "call");
    const puts = contracts.filter((c) => c.type === "put");
    const sum = (xs: OptionContract[], k: "volume" | "open_interest") =>
      xs.reduce((a, c) => a + (c[k] ?? 0), 0);

    const callVol = sum(calls, "volume");
    const putVol = sum(puts, "volume");
    const callOi = sum(calls, "open_interest");
    const putOi = sum(puts, "open_interest");

    // ATM IV: the contract whose delta is closest to 0.5 in magnitude.
    const withDelta = contracts.filter((c) => c.delta != null && c.implied_volatility != null);
    const atm = withDelta.sort(
      (a, b) => Math.abs(Math.abs(a.delta!) - 0.5) - Math.abs(Math.abs(b.delta!) - 0.5),
    )[0];

    // Max pain: strike where total in-the-money open interest value is lowest.
    const strikes = [...new Set(contracts.map((c) => c.strike).filter((x): x is number => x != null))];
    let maxPain: number | null = null;
    let lowest = Infinity;
    for (const k of strikes) {
      let pain = 0;
      for (const c of contracts) {
        if (c.strike == null || c.open_interest == null) continue;
        if (c.type === "call" && k > c.strike) pain += (k - c.strike) * c.open_interest;
        if (c.type === "put" && k < c.strike) pain += (c.strike - k) * c.open_interest;
      }
      if (pain < lowest) { lowest = pain; maxPain = k; }
    }

    const chain: OptionChain = {
      symbol,
      date: data.data[0]?.date ?? opts.date ?? null,
      contracts,
      expirations: [...new Set(contracts.map((c) => c.expiration).filter((x): x is string => !!x))].sort(),
      stats: {
        total_volume: callVol + putVol,
        total_open_interest: callOi + putOi,
        put_call_volume_ratio: callVol > 0 ? +(putVol / callVol).toFixed(3) : null,
        put_call_oi_ratio: callOi > 0 ? +(putOi / callOi).toFixed(3) : null,
        atm_iv: atm?.implied_volatility ?? null,
        max_pain_strike: maxPain,
      },
      source: "alphavantage",
      note:
        `${contracts.length} contracts. Greeks and IV are the provider's, as of the session date — ` +
        "cite that date, not \"now\". Max pain is computed from open interest here, not supplied.",
    };
    avCacheSet(cacheKey, chain);
    return chain;
  } catch {
    return { error: "provider_error", message: "Alpha Vantage did not respond in time." };
  }
}

/** Interpretation hints — turns raw numbers into the questions worth asking. */
export function readTokenSignals(m: TokenMetrics): string[] {
  const out: string[] = [];
  if (m.source === "onchain_only") {
    out.push("No trading pair found — this token has no readable market. Contract metadata only.");
    return out;
  }
  if (m.volume_to_liquidity_h24 != null) {
    if (m.volume_to_liquidity_h24 > 3) {
      out.push(
        `24h volume is ${m.volume_to_liquidity_h24}x liquidity — heavy churn relative to depth. Check whether it is real demand or wash-like round-tripping before calling it accumulation.`,
      );
    } else if (m.volume_to_liquidity_h24 < 0.05) {
      out.push(
        `24h volume is only ${m.volume_to_liquidity_h24}x liquidity — effectively dormant. Any price move here is low-conviction.`,
      );
    }
  }
  if (m.buy_sell_ratio_h24 != null) {
    if (m.buy_sell_ratio_h24 > 1.5) out.push(`Buy/sell count ratio ${m.buy_sell_ratio_h24} — more buy txns than sells, but check average size before reading it as accumulation.`);
    if (m.buy_sell_ratio_h24 < 0.66) out.push(`Buy/sell count ratio ${m.buy_sell_ratio_h24} — sell-side pressure in txn count.`);
  }
  if (m.liquidity_usd != null && m.liquidity_usd < 10_000) {
    out.push(`Liquidity is $${Math.round(m.liquidity_usd).toLocaleString()} — thin. Slippage will dominate any position worth posting about.`);
  }
  if (m.pair_age_days != null && m.pair_age_days < 7) {
    out.push(`Pair is ${m.pair_age_days} days old — no price history to lean on. Treat with the caution a new listing deserves.`);
  }
  if (m.fdv != null && m.market_cap != null && m.market_cap > 0 && m.fdv / m.market_cap > 3) {
    out.push(`FDV is ${(m.fdv / m.market_cap).toFixed(1)}x market cap — significant supply not yet circulating. Ask what unlocks and when.`);
  }
  if (out.length === 0) out.push("No outlier signals in the standard checks — if you post on this, the edge has to come from something these metrics don't show.");
  return out;
}
