import { getDb } from "./db";
import { type FeedPost } from "./posts";
import { getTradeThesis } from "./trade-text";
import { SQL_EXCLUDE_EMPTY_TRADE_FILLS } from "./trade-pricing";

export interface SymbolStats {
  symbol: string;
  product: string | null;
  trade_count: number;
  buy_count: number;
  sell_count: number;
  thesis_count: number;
  /** Posters with App Agentic/Crypto (or non–chain-only). */
  agent_count: number;
  /** MetaMask / Chain-only accounts (no App Agentic or Crypto). */
  normie_count: number;
  volume_usd: number;
  last_trade_at: string | null;
}

export type TickerSort = "trending" | "volume" | "agents";

export function getTickers(
  sort: TickerSort = "trending",
  limit = 50,
  product?: "crypto" | "agentic" | "chain",
): SymbolStats[] {
  const db = getDb();
  const productClause = product ? "AND p.product = ?" : "";
  const productParams = product ? [product] : [];

  const rows = db.prepare(`
    SELECT
      p.symbol AS symbol,
      p.product AS product,
      SUM(CASE WHEN p.type IN ('trade_fill', 'trade_intent') THEN 1 ELSE 0 END) AS trade_count,
      SUM(CASE WHEN p.side = 'buy' THEN 1 ELSE 0 END) AS buy_count,
      SUM(CASE WHEN p.side = 'sell' THEN 1 ELSE 0 END) AS sell_count,
      COUNT(DISTINCT CASE
        WHEN a.has_agentic = 1 OR a.has_crypto = 1 OR IFNULL(a.has_chain, 0) = 0
        THEN p.agent_id END) AS agent_count,
      COUNT(DISTINCT CASE
        WHEN IFNULL(a.has_chain, 0) = 1 AND IFNULL(a.has_agentic, 0) = 0 AND IFNULL(a.has_crypto, 0) = 0
        THEN p.agent_id END) AS normie_count,
      MAX(p.created_at) AS last_trade_at
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.symbol IS NOT NULL
      AND (
        p.type IN ('trade_fill', 'trade_intent')
        OR p.type IN ('general', 'research')
      )
      ${productClause}
    GROUP BY p.symbol, p.product
    HAVING COUNT(*) > 0
  `).all(...productParams) as Omit<SymbolStats, "thesis_count" | "volume_usd">[];

  const volumeBySymbol = new Map<string, number>();
  const volumeProductClause = product ? "AND product = ?" : "";
  const volumeRows = db.prepare(`
    SELECT symbol, product, quantity, price_usd FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol IS NOT NULL
      AND quantity IS NOT NULL AND price_usd IS NOT NULL
      ${volumeProductClause}
  `).all(...productParams) as {
    symbol: string;
    product: string | null;
    quantity: string;
    price_usd: string;
  }[];

  for (const r of volumeRows) {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.price_usd);
    if (!Number.isFinite(q) || !Number.isFinite(p)) continue;
    const key = `${(r.product ?? "").toLowerCase()}:${r.symbol.toUpperCase()}`;
    volumeBySymbol.set(key, (volumeBySymbol.get(key) ?? 0) + q * p);
  }

  const stats: SymbolStats[] = rows.map((row) => ({
    ...row,
    agent_count: Number(row.agent_count) || 0,
    normie_count: Number(row.normie_count) || 0,
    thesis_count: countThesesForSymbol(db, row.symbol, row.product),
    volume_usd:
      volumeBySymbol.get(`${(row.product ?? "").toLowerCase()}:${row.symbol.toUpperCase()}`) ?? 0,
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

export function getSymbolStats(
  symbol: string,
  product?: "crypto" | "agentic" | "chain" | null,
): SymbolStats | null {
  const db = getDb();
  const params: string[] = [symbol.toUpperCase()];
  if (product) params.push(product);

  const row = db.prepare(`
    SELECT
      p.symbol AS symbol,
      ${product ? "p.product AS product" : "MAX(p.product) AS product"},
      SUM(CASE WHEN p.type IN ('trade_fill', 'trade_intent') THEN 1 ELSE 0 END) AS trade_count,
      SUM(CASE WHEN p.side = 'buy' THEN 1 ELSE 0 END) AS buy_count,
      SUM(CASE WHEN p.side = 'sell' THEN 1 ELSE 0 END) AS sell_count,
      COUNT(DISTINCT CASE
        WHEN a.has_agentic = 1 OR a.has_crypto = 1 OR IFNULL(a.has_chain, 0) = 0
        THEN p.agent_id END) AS agent_count,
      COUNT(DISTINCT CASE
        WHEN IFNULL(a.has_chain, 0) = 1 AND IFNULL(a.has_agentic, 0) = 0 AND IFNULL(a.has_crypto, 0) = 0
        THEN p.agent_id END) AS normie_count,
      MAX(p.created_at) AS last_trade_at
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.symbol = ?
      AND (
        p.type IN ('trade_fill', 'trade_intent')
        OR p.type IN ('general', 'research')
      )
      ${product ? "AND p.product = ?" : ""}
    GROUP BY p.symbol${product ? ", p.product" : ""}
  `).get(...params) as Omit<SymbolStats, "thesis_count" | "volume_usd"> | undefined;
  if (!row) return null;
  const volume = volumeForSymbol(db, symbol, product ?? row.product);
  return {
    ...row,
    agent_count: Number(row.agent_count) || 0,
    normie_count: Number(row.normie_count) || 0,
    thesis_count: countThesesForSymbol(db, symbol, product ?? row.product),
    volume_usd: volume,
  };
}

export type SymbolTab = "thesis" | "all" | "buys" | "sells";

export function getSymbolPosts(
  symbol: string,
  tab: SymbolTab = "all",
  limit = 50,
  product?: "crypto" | "agentic" | "chain" | null,
): FeedPost[] {
  const db = getDb();
  let sideFilter = "";
  const params: (string | number)[] = [symbol.toUpperCase()];
  const productClause = product ? "AND p.product = ?" : "";
  if (product) params.push(product);

  if (tab === "buys") sideFilter = "AND p.side = 'buy'";
  else if (tab === "sells") sideFilter = "AND p.side = 'sell'";

  params.push(limit);

  const rows = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           a.active_skill_name AS agent_active_skill_name,
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.symbol = ?
      AND (
        p.type IN ('trade_fill', 'trade_intent')
        OR p.type IN ('general', 'research')
      )
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
      ${productClause}
      ${sideFilter}
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...params) as FeedPost[];

  if (tab === "thesis") {
    return rows.filter(
      (p) =>
        (p.type === "trade_fill" || p.type === "trade_intent") &&
        getTradeThesis(p.body) !== null,
    );
  }

  if (tab === "buys" || tab === "sells") {
    return rows.filter((p) => p.type === "trade_fill" || p.type === "trade_intent");
  }

  return rows;
}

function countThesesForSymbol(
  db: ReturnType<typeof getDb>,
  symbol: string,
  product?: string | null,
): number {
  const productClause = product ? "AND product = ?" : "";
  const params: string[] = [symbol.toUpperCase()];
  if (product) params.push(product);
  const rows = db.prepare(`
    SELECT body FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol = ?
      ${productClause}
  `).all(...params) as { body: string }[];

  return rows.filter((r) => getTradeThesis(r.body) !== null).length;
}

function volumeForSymbol(
  db: ReturnType<typeof getDb>,
  symbol: string,
  product?: string | null,
): number {
  const productClause = product ? "AND product = ?" : "";
  const params: string[] = [symbol.toUpperCase()];
  if (product) params.push(product);
  const rows = db.prepare(`
    SELECT quantity, price_usd FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol = ?
      AND quantity IS NOT NULL AND price_usd IS NOT NULL
      ${productClause}
  `).all(...params) as { quantity: string; price_usd: string }[];

  let total = 0;
  for (const r of rows) {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.price_usd);
    if (Number.isFinite(q) && Number.isFinite(p)) total += q * p;
  }
  return total;
}
