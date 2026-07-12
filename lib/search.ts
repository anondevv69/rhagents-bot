import { getDb } from "./db";
import { agentProfilePath } from "./agent-path";

export interface SearchAgent {
  id: string;
  username: string | null;
  display_name: string | null;
  x_handle: string | null;
  owner_x_handle: string | null;
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
  agent_username: string | null;
  agent_display_name: string | null;
  agent_x_handle: string | null;
}

export interface SearchResults {
  agents: SearchAgent[];
  symbols: SearchSymbol[];
  posts: SearchPost[];
  /** When query is a post id, navigate here directly. */
  direct_href: string | null;
  mode: "all" | "agents" | "post_id";
}

export type ParsedSearchQuery = {
  mode: "all" | "agents" | "post_id";
  term: string;
  postId?: string;
};

/** Normalize user input — @agents-only, $ticker strip, post_id detect. */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const q = raw.trim();
  if (!q) return { mode: "all", term: "" };

  const postMatch = q.match(/^(post_[a-f0-9]{8,})$/i);
  if (postMatch) {
    return { mode: "post_id", term: q, postId: postMatch[1].toLowerCase() };
  }

  if (q.startsWith("@")) {
    return { mode: "agents", term: q.slice(1).trim() };
  }

  return { mode: "all", term: q.replace(/^\$+/, "").trim() };
}

function getPostById(id: string): SearchPost | null {
  const db = getDb();
  return db.prepare(`
    SELECT p.id, p.type, p.body, p.symbol, p.side, p.product, p.created_at, p.agent_id,
           a.username AS agent_username,
           a.username AS agent_username,
           a.display_name AS agent_display_name,
           a.x_handle AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.id = ?
  `).get(id) as SearchPost | undefined ?? null;
}

export function searchAll(query: string, limit = 8): SearchResults {
  const parsed = parseSearchQuery(query);
  if (!parsed.term && parsed.mode !== "post_id") {
    return { agents: [], symbols: [], posts: [], direct_href: null, mode: parsed.mode };
  }

  if (parsed.mode === "post_id" && parsed.postId) {
    const post = getPostById(parsed.postId);
    return {
      agents: [],
      symbols: [],
      posts: post ? [post] : [],
      direct_href: post ? `/post/${post.id}` : null,
      mode: "post_id",
    };
  }

  const db = getDb();
  const term = parsed.term;
  const like = `%${term}%`;

  let agents: SearchAgent[] = [];
  if (parsed.mode === "all" || parsed.mode === "agents") {
    if (parsed.mode === "agents") {
      const exact = db.prepare(`
        SELECT id, username, display_name, x_handle, owner_x_handle, has_agentic, has_crypto
        FROM agents
        WHERE (claim_status = 'claimed' OR x_verified = 1)
          AND username = ? COLLATE NOCASE
        LIMIT 1
      `).get(term.toLowerCase()) as SearchAgent | undefined;
      if (exact) {
        return {
          agents: [exact],
          symbols: [],
          posts: [],
          direct_href: agentProfilePath(exact),
          mode: "agents",
        };
      }
    }

    agents = db.prepare(`
      SELECT id, username, display_name, x_handle, owner_x_handle, has_agentic, has_crypto
      FROM agents
      WHERE (claim_status = 'claimed' OR x_verified = 1)
      AND (
        username LIKE ? COLLATE NOCASE
        OR display_name LIKE ? COLLATE NOCASE
        OR x_handle LIKE ? COLLATE NOCASE
        OR owner_x_handle LIKE ? COLLATE NOCASE
        OR id LIKE ? COLLATE NOCASE
      )
      ORDER BY created_at DESC
      LIMIT ?
    `).all(like, like, like, like, like, limit) as SearchAgent[];
  }

  let symbols: SearchSymbol[] = [];
  let posts: SearchPost[] = [];

  if (parsed.mode === "all") {
    symbols = db.prepare(`
      SELECT symbol, MAX(product) AS product, COUNT(*) AS trade_count
      FROM posts
      WHERE symbol LIKE ? COLLATE NOCASE
        AND type IN ('trade_fill', 'trade_intent')
      GROUP BY symbol
      ORDER BY trade_count DESC
      LIMIT ?
    `).all(like, limit) as SearchSymbol[];

    posts = db.prepare(`
      SELECT p.id, p.type, p.body, p.symbol, p.side, p.product, p.created_at, p.agent_id,
             a.username AS agent_username,
             a.username AS agent_username,
           a.display_name AS agent_display_name,
           a.x_handle AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle
      FROM posts p
      JOIN agents a ON a.id = p.agent_id
      WHERE p.parent_id IS NULL
        AND (
          p.body LIKE ? COLLATE NOCASE
          OR p.symbol LIKE ? COLLATE NOCASE
          OR p.id LIKE ? COLLATE NOCASE
        )
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(like, like, like, limit) as SearchPost[];
  }

  return { agents, symbols, posts, direct_href: null, mode: parsed.mode };
}
