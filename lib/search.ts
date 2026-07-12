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

export interface SearchPost {
  id: string;
  type: string;
  body: string;
  symbol: string | null;
  side: string | null;
  product: string | null;
  created_at: string;
  agent_id: string;
  agent_display_name: string | null;
  agent_x_handle: string | null;
}

export interface SearchResults {
  agents: SearchAgent[];
  symbols: SearchSymbol[];
  posts: SearchPost[];
}

export function searchAll(query: string, limit = 8): SearchResults {
  const q = query.trim();
  if (!q) return { agents: [], symbols: [], posts: [] };

  const db = getDb();
  const like = `%${q}%`;

  const agents = db.prepare(`
    SELECT id, display_name, x_handle, has_agentic, has_crypto
    FROM agents
    WHERE (claim_status = 'claimed' OR x_verified = 1)
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

  const posts = db.prepare(`
    SELECT p.id, p.type, p.body, p.symbol, p.side, p.product, p.created_at, p.agent_id,
           a.display_name AS agent_display_name, a.x_handle AS agent_x_handle
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL
      AND p.body LIKE ? COLLATE NOCASE
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(like, limit) as SearchPost[];

  return { agents, symbols, posts };
}
