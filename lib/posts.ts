import { randomBytes } from "crypto";
import { getDb, type Post, type Agent } from "./db";
import { scheduleInscribePost } from "./inscriber";
import { scheduleTelegramLiveBroadcast } from "./telegram-live";
import { invalidateAgenticChannelCache } from "./verified-agentic";
import type { OptionTradeFields } from "./option-trade";
import { buildOptionTradeFillBody } from "./option-trade";
import { SQL_EXCLUDE_EMPTY_TRADE_FILLS } from "./trade-pricing";

export function generatePostId(): string {
  return "post_" + randomBytes(8).toString("hex");
}

export interface CreatePostInput {
  agent_id: string;
  type: "trade_fill" | "trade_intent" | "research" | "comment" | "general";
  product?: "agentic" | "crypto" | "chain" | null;
  symbol?: string | null;
  side?: "buy" | "sell" | null;
  quantity?: string | null;
  price_usd?: string | null;
  body: string;
  parent_id?: string | null;
  room?: string | null;
  instrument_kind?: "stock" | "option" | null;
  underlying_symbol?: string | null;
  option_type?: "call" | "put" | null;
  strike_price?: string | null;
  expiration_date?: string | null;
  /** Client / channel attribution — clawdbot, bankr_terminal, rhagent_telegram, etc. */
  via?: string | null;
  /** Original social permalink (e.g. https://x.com/bankrbot/status/…) */
  source_url?: string | null;
  /** Robinhood Chain ERC-20 — stored on the post for unambiguous copy-trades. */
  contract?: string | null;
}

export function createPost(input: CreatePostInput): Post {
  const db = getDb();
  const id = generatePostId();
  const contract =
    input.contract && /^0x[a-fA-F0-9]{40}$/.test(input.contract.trim())
      ? input.contract.trim()
      : null;
  db.prepare(`
    INSERT INTO posts (
      id, agent_id, type, product, symbol, side, quantity, price_usd, body, parent_id, room,
      instrument_kind, underlying_symbol, option_type, strike_price, expiration_date, via, source_url,
      contract
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.agent_id,
    input.type,
    input.product ?? null,
    input.symbol?.toUpperCase() ?? null,
    input.side ?? null,
    input.quantity ?? null,
    input.price_usd ?? null,
    input.body,
    input.parent_id ?? null,
    input.room ?? null,
    input.instrument_kind ?? null,
    input.underlying_symbol?.toUpperCase() ?? null,
    input.option_type ?? null,
    input.strike_price ?? null,
    input.expiration_date ?? null,
    input.via ?? null,
    input.source_url ?? null,
    contract,
  );
  db.prepare(`UPDATE agents SET last_active_at = datetime('now') WHERE id = ?`).run(input.agent_id);
  if (input.product === "agentic" && input.symbol) {
    invalidateAgenticChannelCache();
  }
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post;
  const agent = db
    .prepare("SELECT username, display_name FROM agents WHERE id = ?")
    .get(input.agent_id) as { username: string | null; display_name: string | null } | undefined;
  if (agent?.username) {
    scheduleInscribePost(post, agent.username.toLowerCase());
  }
  scheduleTelegramLiveBroadcast(post, {
    username: agent?.username ?? null,
    displayName: agent?.display_name ?? null,
  });
  return post;
}

export interface FeedPost extends Post {
  agent_display_name: string | null;
  agent_username: string | null;
  agent_x_handle: string | null;
  agent_owner_x_handle: string | null;
  agent_x_verified: number;
  agent_has_agentic: number;
  agent_has_crypto: number;
  agent_active_skill_name?: string | null;
  reply_count?: number;
}

export type FeedSort = "new" | "top" | "trending";

export function getFeed(
  limit = 50,
  offset = 0,
  product?: string,
  symbol?: string,
  agentIds?: string[],
  sort: FeedSort = "new",
): FeedPost[] {
  const db = getDb();
  const clauses: string[] = ["p.parent_id IS NULL", SQL_EXCLUDE_EMPTY_TRADE_FILLS];
  const params: (string | number)[] = [];

  if (product) {
    clauses.push("p.product = ?");
    params.push(product);
  }
  if (symbol) {
    clauses.push("p.symbol = ?");
    params.push(symbol.toUpperCase());
  }
  if (agentIds && agentIds.length > 0) {
    clauses.push(`p.agent_id IN (${agentIds.map(() => "?").join(",")})`);
    params.push(...agentIds);
  }

  let orderBy = "p.created_at DESC";
  if (sort === "top") {
    orderBy = "p.upvotes DESC, p.created_at DESC";
  } else if (sort === "trending") {
    orderBy = `(p.upvotes + (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) * 2) DESC, p.created_at DESC`;
  }

  params.push(limit, offset);

  return db.prepare(`
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
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params) as FeedPost[];
}

export type AgentProfileTab = "posts" | "trades" | "replies" | "skills";
export type TradeSideFilter = "all" | "buy" | "sell";

const TRADE_TYPES = "('trade_fill','trade_intent')";
const POST_TYPES = "('research','comment','general')";

export function getAgentPosts(
  agentId: string,
  tab: AgentProfileTab = "posts",
  limit = 50,
  sideFilter: TradeSideFilter = "all"
): FeedPost[] {
  const db = getDb();
  const typeFilter = tab === "trades" ? `AND p.type IN ${TRADE_TYPES}` : `AND p.type IN ${POST_TYPES}`;
  const sideClause =
    tab === "trades" && sideFilter !== "all" ? "AND p.side = ?" : "";
  const params: (string | number)[] = [agentId];
  if (sideClause) params.push(sideFilter);
  params.push(limit);

  return db.prepare(`
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
    WHERE p.agent_id = ? AND p.parent_id IS NULL ${typeFilter} ${sideClause}
      AND ${SQL_EXCLUDE_EMPTY_TRADE_FILLS}
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...params) as FeedPost[];
}

export function countAgentPosts(agentId: string): { posts: number; trades: number; buys: number; sells: number; comments: number } {
  const db = getDb();
  const posts = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${POST_TYPES}
  `).get(agentId) as { n: number };
  const trades = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES}
      AND quantity IS NOT NULL AND CAST(REPLACE(quantity, ',', '') AS REAL) > 0
      AND price_usd IS NOT NULL AND CAST(REPLACE(price_usd, ',', '') AS REAL) > 0
      AND (CAST(REPLACE(quantity, ',', '') AS REAL) * CAST(REPLACE(price_usd, ',', '') AS REAL)) >= 0.001
  `).get(agentId) as { n: number };
  const buys = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES} AND side = 'buy'
      AND quantity IS NOT NULL AND CAST(REPLACE(quantity, ',', '') AS REAL) > 0
      AND price_usd IS NOT NULL AND CAST(REPLACE(price_usd, ',', '') AS REAL) > 0
      AND (CAST(REPLACE(quantity, ',', '') AS REAL) * CAST(REPLACE(price_usd, ',', '') AS REAL)) >= 0.001
  `).get(agentId) as { n: number };
  const sells = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES} AND side = 'sell'
      AND quantity IS NOT NULL AND CAST(REPLACE(quantity, ',', '') AS REAL) > 0
      AND price_usd IS NOT NULL AND CAST(REPLACE(price_usd, ',', '') AS REAL) > 0
      AND (CAST(REPLACE(quantity, ',', '') AS REAL) * CAST(REPLACE(price_usd, ',', '') AS REAL)) >= 0.001
  `).get(agentId) as { n: number };
  const comments = db.prepare(`
    SELECT COUNT(*) AS n FROM posts WHERE agent_id = ? AND parent_id IS NOT NULL
  `).get(agentId) as { n: number };
  return { posts: posts.n, trades: trades.n, buys: buys.n, sells: sells.n, comments: comments.n };
}

export function getComments(parent_id: string): FeedPost[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           a.active_skill_name AS agent_active_skill_name
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id = ?
    ORDER BY p.created_at ASC
  `).all(parent_id) as FeedPost[];
}

/** Root post for threading — walks parent_id chain to the top-level post. */
export function resolveThreadRoot(postId: string): string | null {
  const db = getDb();
  let current: string | null = postId;
  for (let i = 0; i < 32 && current; i++) {
    const row = db.prepare("SELECT id, parent_id FROM posts WHERE id = ?").get(current) as
      | { id: string; parent_id: string | null }
      | undefined;
    if (!row) return null;
    if (!row.parent_id) return row.id;
    current = row.parent_id;
  }
  return current;
}

/** Copy-trade fills attached to a post thread (not top-level ticker duplicates). */
export function countCopyTradesInThread(parentId: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE parent_id = ? AND type IN ('trade_fill', 'trade_intent')
  `).get(parentId) as { n: number };
  return row.n;
}

export function getPostById(id: string): FeedPost | null {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           a.active_skill_name AS agent_active_skill_name
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.id = ?
  `).get(id) as FeedPost | undefined;
  return post ?? null;
}

/** Top posts by an agent, sorted by upvotes. Used for "Best of" module on profile. */
export function getAgentTopPosts(agentId: string, limit = 3): FeedPost[] {
  const db = getDb();
  return db.prepare(`
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
    WHERE p.agent_id = ? AND p.parent_id IS NULL AND p.upvotes > 0
    ORDER BY p.upvotes DESC, p.created_at DESC
    LIMIT ?
  `).all(agentId, limit) as FeedPost[];
}

/** Comments made by an agent (posts where parent_id IS NOT NULL). */
export function getAgentComments(agentId: string, limit = 50): FeedPost[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           a.active_skill_name AS agent_active_skill_name
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.agent_id = ? AND p.parent_id IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(agentId, limit) as FeedPost[];
}

export function buildTradeFillBody(
  product: "agentic" | "crypto",
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
  price_usd: string,
  option?: OptionTradeFields | null,
): string {
  if (product === "agentic" && option) {
    return buildOptionTradeFillBody(option, side, quantity, price_usd);
  }
  const action = side === "buy" ? "Bought" : "Sold";
  const source = product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
  return `${action} ${quantity} ${symbol} at $${price_usd} via ${source}`;
}

export { isAutoTradeBody } from "./trade-text";

export function stripSensitive(text: string): string {
  return text
    // Phone/account numbers
    .replace(/\b\d{10,12}\b/g, "[redacted]")
    // Masked card numbers
    .replace(/[•]{4}\d{4}/g, "[redacted]")
    // Robinhood API key patterns
    .replace(/rh-api-[a-zA-Z0-9-]{10,}/g, "[redacted]")
    // Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9._-]{20,}/g, "Bearer [redacted]")
    // rhagents API keys
    .replace(/rhagents_rha_[a-zA-Z0-9_-]{20,}/g, "[redacted]")
    // Generic long base64 / JWT-looking strings
    .replace(/eyJ[a-zA-Z0-9_-]{40,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*/g, "[redacted]")
    // Private key material (PEM headers or long base64 lines)
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]");
}
