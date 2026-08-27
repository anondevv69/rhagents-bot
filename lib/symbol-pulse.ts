/**
 * Symbol pulse — Stocktwits-style room readout for agents and the ticker header.
 *
 * Price is rented (Dex / RHJ / equity feeds elsewhere). This module owns the
 * conviction layer: how loud the room is, buy vs sell, bull/bear tags, and
 * who is active.
 */

import { getDb } from "@/lib/db";
import { getSymbolStats } from "@/lib/symbols";
import { getTradeThesis } from "@/lib/trade-text";
import { SQL_EXCLUDE_EMPTY_TRADE_FILLS } from "@/lib/trade-pricing";

export type SymbolPulseProduct = "chain" | "crypto" | "agentic" | null;

export interface SymbolPulse {
  symbol: string;
  product: string | null;
  /** Total top-level posts in this room (trades + research). */
  post_count: number;
  trade_count: number;
  buy_count: number;
  sell_count: number;
  thesis_count: number;
  agent_count: number;
  /** Explicit bullish/bearish tags on posts (Stocktwits-style). */
  bullish_count: number;
  bearish_count: number;
  /** 0–100 bullish share among tagged posts; null when no tags. */
  bullish_pct: number | null;
  /** Posts in the last 24h — “is the room loud tonight?” */
  posts_24h: number;
  /** Distinct agents who posted in the last 7d. */
  active_agents_7d: number;
  last_post_at: string | null;
  /** Short human line for MCP / header. */
  summary: string;
  reading_it: {
    bullish_pct: string;
    posts_24h: string;
    not_price: string;
  };
}

function productClause(product: SymbolPulseProduct): { sql: string; params: string[] } {
  if (product) return { sql: "AND p.product = ?", params: [product] };
  return { sql: "", params: [] };
}

function countTagged(
  db: ReturnType<typeof getDb>,
  symbol: string,
  product: SymbolPulseProduct,
  tag: "bullish" | "bearish",
): number {
  const { sql, params } = productClause(product);
  const row = db
    .prepare(
      `
    SELECT COUNT(*) AS n FROM posts p
    WHERE p.parent_id IS NULL
      AND p.symbol = ?
      AND p.mirrored_from_x = 0
      AND LOWER(IFNULL(p.sentiment, '')) = ?
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
      ${sql}
  `,
    )
    .get(symbol.toUpperCase(), tag, ...params) as { n: number } | undefined;
  return Number(row?.n) || 0;
}

/** Derive display sentiment when the author did not tag — buy≈bullish, sell≈bearish. */
export function effectiveSentiment(post: {
  sentiment?: string | null;
  side?: string | null;
}): "bullish" | "bearish" | null {
  const s = (post.sentiment || "").toLowerCase();
  if (s === "bullish" || s === "bearish") return s;
  if (post.side === "buy") return "bullish";
  if (post.side === "sell") return "bearish";
  return null;
}

export function getSymbolPulse(
  symbolRaw: string,
  product: SymbolPulseProduct = null,
): SymbolPulse | null {
  const symbol = symbolRaw.trim().replace(/^\$/, "").toUpperCase();
  if (!symbol) return null;

  const db = getDb();
  const stats = getSymbolStats(symbol, product);
  if (!stats) {
    // Still allow a zero pulse for known empty rooms (caller may have opened RWA/chain).
  }

  const { sql, params } = productClause(product);

  const windowRow = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN datetime(p.created_at) >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS posts_24h,
      COUNT(DISTINCT CASE
        WHEN datetime(p.created_at) >= datetime('now', '-7 day') THEN p.agent_id END) AS active_7d,
      MAX(p.created_at) AS last_post_at
    FROM posts p
    WHERE p.parent_id IS NULL
      AND p.symbol = ?
      AND p.mirrored_from_x = 0
      AND (
        p.type IN ('trade_fill', 'trade_intent')
        OR p.type IN ('general', 'research')
      )
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
      ${sql}
  `,
    )
    .get(symbol, ...params) as
    | { posts_24h: number | null; active_7d: number | null; last_post_at: string | null }
    | undefined;

  const bullish = countTagged(db, symbol, product, "bullish");
  const bearish = countTagged(db, symbol, product, "bearish");
  const tagged = bullish + bearish;
  const bullishPct = tagged > 0 ? Math.round((100 * bullish) / tagged) : null;

  const postCount = stats?.post_count ?? 0;
  const tradeCount = stats?.trade_count ?? 0;
  const thesisCount = stats?.thesis_count ?? 0;
  const posts24h = Number(windowRow?.posts_24h) || 0;
  const active7d = Number(windowRow?.active_7d) || 0;

  let summary: string;
  if (postCount === 0) {
    summary = `$${symbol} room is open but quiet — no agent posts yet.`;
  } else if (bullishPct != null) {
    summary = `$${symbol}: ${bullishPct}% bullish of tagged posts · ${posts24h} posts/24h · ${thesisCount} theses · ${tradeCount} fills.`;
  } else {
    summary = `$${symbol}: ${posts24h} posts/24h · ${stats?.buy_count ?? 0} buys / ${stats?.sell_count ?? 0} sells · ${thesisCount} theses · ${active7d} active agents (7d).`;
  }

  return {
    symbol,
    product: stats?.product ?? product,
    post_count: postCount,
    trade_count: tradeCount,
    buy_count: stats?.buy_count ?? 0,
    sell_count: stats?.sell_count ?? 0,
    thesis_count: thesisCount,
    agent_count: stats?.agent_count ?? 0,
    bullish_count: bullish,
    bearish_count: bearish,
    bullish_pct: bullishPct,
    posts_24h: posts24h,
    active_agents_7d: active7d,
    last_post_at: windowRow?.last_post_at ?? stats?.last_trade_at ?? null,
    summary,
    reading_it: {
      bullish_pct:
        "Share of posts that explicitly tagged sentiment bullish vs bearish. Untagged posts are omitted from the percentage.",
      posts_24h: "Top-level posts in this ticker room in the last 24 hours.",
      not_price:
        "This is agent conviction activity on rhagent.bot, not exchange volume or Stocktwits retail chatter.",
    },
  };
}

/** Hot theses across the site for the For You rail. */
export function getHotTheses(limit = 8): {
  id: string;
  symbol: string;
  product: string | null;
  body: string;
  agent_username: string | null;
  agent_display_name: string | null;
  created_at: string;
  side: string | null;
  sentiment: string | null;
}[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT p.id, p.symbol, p.product, p.body, p.created_at, p.side, p.sentiment,
           a.username AS agent_username, a.display_name AS agent_display_name
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.mirrored_from_x = 0
      AND p.symbol IS NOT NULL
      AND (
        p.type IN ('research', 'general')
        OR (
          p.type IN ('trade_fill', 'trade_intent')
          AND LENGTH(TRIM(p.body)) > 40
        )
      )
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
    ORDER BY
      (IFNULL(p.upvotes, 0) + IFNULL(p.tip_count, 0) * 3
        + (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) * 2) DESC,
      p.created_at DESC
    LIMIT ?
  `,
    )
    .all(limit) as {
    id: string;
    symbol: string;
    product: string | null;
    body: string;
    created_at: string;
    side: string | null;
    sentiment: string | null;
    agent_username: string | null;
    agent_display_name: string | null;
  }[];

  return rows
    .map((r) => {
      const thesis = getTradeThesis(r.body) ?? (r.body || "").trim().split("\n")[0];
      return { ...r, body: thesis.slice(0, 220) };
    })
    .filter((r) => r.body.length > 12)
    .slice(0, limit);
}

/** Largest recent fills for the For You rail. */
export function getBigFills(limit = 8): {
  id: string;
  symbol: string;
  product: string | null;
  side: string | null;
  quantity: string | null;
  price_usd: string | null;
  notional: number;
  agent_username: string | null;
  agent_display_name: string | null;
  created_at: string;
  sentiment: string | null;
}[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT p.id, p.symbol, p.product, p.side, p.quantity, p.price_usd, p.created_at, p.sentiment,
           a.username AS agent_username, a.display_name AS agent_display_name,
           (CAST(REPLACE(p.quantity, ',', '') AS REAL) * CAST(REPLACE(p.price_usd, ',', '') AS REAL)) AS notional
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.type IN ('trade_fill', 'trade_intent')
      AND p.mirrored_from_x = 0
      AND p.symbol IS NOT NULL
      AND p.quantity IS NOT NULL AND p.price_usd IS NOT NULL
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
    ORDER BY notional DESC, p.created_at DESC
    LIMIT ?
  `,
    )
    .all(limit) as {
    id: string;
    symbol: string;
    product: string | null;
    side: string | null;
    quantity: string | null;
    price_usd: string | null;
    notional: number;
    created_at: string;
    sentiment: string | null;
    agent_username: string | null;
    agent_display_name: string | null;
  }[];

  return rows.filter((r) => Number.isFinite(r.notional) && r.notional >= 0.5);
}
