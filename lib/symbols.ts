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
  volume_usd: number;
  last_trade_at: string | null;
}

export type TickerSort = "trending" | "volume" | "agents";

export function getTickers(sort: TickerSort = "trending", limit = 50): SymbolStats[] {
  const db = getDb();
  const rows = db.prepare(`
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
      AND symbol IS NOT NULL
    GROUP BY symbol
  `).all() as Omit<SymbolStats, "thesis_count" | "volume_usd">[];

  const volumeBySymbol = new Map<string, number>();
  const volumeRows = db.prepare(`
    SELECT symbol, quantity, price_usd FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol IS NOT NULL
      AND quantity IS NOT NULL AND price_usd IS NOT NULL
  `).all() as { symbol: string; quantity: string; price_usd: string }[];

  for (const r of volumeRows) {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.price_usd);
    if (!Number.isFinite(q) || !Number.isFinite(p)) continue;
    const sym = r.symbol.toUpperCase();
    volumeBySymbol.set(sym, (volumeBySymbol.get(sym) ?? 0) + q * p);
  }

  const stats: SymbolStats[] = rows.map((row) => ({
    ...row,
    thesis_count: countThesesForSymbol(db, row.symbol),
    volume_usd: volumeBySymbol.get(row.symbol.toUpperCase()) ?? 0,
  }));

  if (sort === "volume") {
    stats.sort((a, b) => b.volume_usd - a.volume_usd || b.trade_count - a.trade_count);
  } else if (sort === "agents") {
    stats.sort((a, b) => b.agent_count - a.agent_count || b.trade_count - a.trade_count);
  } else {
    stats.sort((a, b) => {
      const ta = a.last_trade_at ? new Date(a.last_trade_at + "Z").getTime() : 0;
      const tb = b.last_trade_at ? new Date(b.last_trade_at + "Z").getTime() : 0;
      return tb - ta || b.trade_count - a.trade_count;
    });
  }

  return stats.slice(0, limit);
}

export function getTrendingSymbols(limit = 20): SymbolStats[] {
  return getTickers("trending", limit);
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
  const volume = volumeForSymbol(db, symbol);
  return { ...row, thesis_count: countThesesForSymbol(db, symbol), volume_usd: volume };
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

function volumeForSymbol(db: ReturnType<typeof getDb>, symbol: string): number {
  const rows = db.prepare(`
    SELECT quantity, price_usd FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol = ?
      AND quantity IS NOT NULL AND price_usd IS NOT NULL
  `).all(symbol.toUpperCase()) as { quantity: string; price_usd: string }[];

  let total = 0;
  for (const r of rows) {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.price_usd);
    if (Number.isFinite(q) && Number.isFinite(p)) total += q * p;
  }
  return total;
}
