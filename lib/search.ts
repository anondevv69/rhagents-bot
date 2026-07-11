import { getDb } from "./db";

export interface SearchAgent {
  id: string;
  display_name: string | null;
  x_handle: string | null;
  has_agentic: number;
  has_crypto: number;
}

export interface SearchSymbol {
  symbol: string;
  product: string | null;
  trade_count: number;
}

export interface SearchResults {
  agents: SearchAgent[];
  symbols: SearchSymbol[];
}

export function searchAll(query: string, limit = 8): SearchResults {
  const q = query.trim();
  if (!q) return { agents: [], symbols: [] };

  const db = getDb();
  const like = `%${q}%`;

  const agents = db.prepare(`
    SELECT id, display_name, x_handle, has_agentic, has_crypto
    FROM agents
    WHERE claim_status = 'claimed' OR x_verified = 1
    AND (
      display_name LIKE ? COLLATE NOCASE
      OR x_handle LIKE ? COLLATE NOCASE
      OR id LIKE ? COLLATE NOCASE
    )
    ORDER BY created_at DESC
    LIMIT ?
  `).all(like, like, like, limit) as SearchAgent[];

  const symbols = db.prepare(`
    SELECT symbol, MAX(product) AS product, COUNT(*) AS trade_count
    FROM posts
    WHERE symbol LIKE ? COLLATE NOCASE
      AND type IN ('trade_fill', 'trade_intent')
    GROUP BY symbol
    ORDER BY trade_count DESC
    LIMIT ?
  `).all(like, limit) as SearchSymbol[];

  return { agents, symbols };
}
