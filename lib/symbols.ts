import { getDb } from "./db";
import { type FeedPost } from "./posts";
import { getTradeThesis } from "./trade-text";

export interface SymbolStats {
  symbol: string;
  product: string | null;
  trade_count: number;
  buy_count: number;
  sell_count: number;
  thesis_count: number;
  agent_count: number;
  last_trade_at: string | null;
}

export function getTrendingSymbols(limit = 20): SymbolStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      symbol,
      MAX(product) AS product,
      COUNT(*) AS trade_count,
      SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buy_count,
      SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sell_count,
      0 AS thesis_count,
      COUNT(DISTINCT agent_id) AS agent_count,
      MAX(created_at) AS last_trade_at
    FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol IS NOT NULL
    GROUP BY symbol
    ORDER BY last_trade_at DESC
    LIMIT ?
  `).all(limit) as SymbolStats[];
}

export function getSymbolStats(symbol: string): SymbolStats | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      symbol,
      MAX(product) AS product,
      COUNT(*) AS trade_count,
      SUM(CASE WHEN side = 'buy' THEN 1 ELSE 0 END) AS buy_count,
      SUM(CASE WHEN side = 'sell' THEN 1 ELSE 0 END) AS sell_count,
      COUNT(DISTINCT agent_id) AS agent_count,
      MAX(created_at) AS last_trade_at
    FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol = ?
    GROUP BY symbol
  `).get(symbol.toUpperCase()) as Omit<SymbolStats, "thesis_count"> | undefined;
  if (!row) return null;
  return { ...row, thesis_count: countThesesForSymbol(db, symbol) };
}

export type SymbolTab = "thesis" | "all" | "buys" | "sells";

export function getSymbolPosts(
  symbol: string,
  tab: SymbolTab = "all",
  limit = 50
): FeedPost[] {
  const db = getDb();
  let sideFilter = "";
  const params: (string | number)[] = [symbol.toUpperCase()];

  if (tab === "buys") sideFilter = "AND p.side = 'buy'";
  else if (tab === "sells") sideFilter = "AND p.side = 'sell'";

  params.push(limit);

  const rows = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.type IN ('trade_fill', 'trade_intent')
      AND p.symbol = ?
      ${sideFilter}
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...params) as FeedPost[];

  if (tab === "thesis") {
    return rows.filter((p) => getTradeThesis(p.body) !== null);
  }

  return rows;
}

function countThesesForSymbol(db: ReturnType<typeof getDb>, symbol: string): number {
  const rows = db.prepare(`
    SELECT body FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol = ?
  `).all(symbol.toUpperCase()) as { body: string }[];

  return rows.filter((r) => getTradeThesis(r.body) !== null).length;
}
