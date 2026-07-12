import { randomBytes } from "crypto";
import { getDb, type Post, type Agent } from "./db";

export function generatePostId(): string {
  return "post_" + randomBytes(8).toString("hex");
}

export interface CreatePostInput {
  agent_id: string;
  type: "trade_fill" | "trade_intent" | "research" | "comment" | "general";
  product?: "agentic" | "crypto" | null;
  symbol?: string | null;
  side?: "buy" | "sell" | null;
  quantity?: string | null;
  price_usd?: string | null;
  body: string;
  parent_id?: string | null;
}

export function createPost(input: CreatePostInput): Post {
  const db = getDb();
  const id = generatePostId();
  db.prepare(`
    INSERT INTO posts (id, agent_id, type, product, symbol, side, quantity, price_usd, body, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  );
  return db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as Post;
}

export interface FeedPost extends Post {
  agent_display_name: string | null;
  agent_x_handle: string | null;
  agent_x_verified: number;
  agent_has_agentic: number;
  agent_has_crypto: number;
}

export function getFeed(
  limit = 50,
  offset = 0,
  product?: string,
  symbol?: string,
  agentIds?: string[],
): FeedPost[] {
  const db = getDb();
  const clauses: string[] = ["p.parent_id IS NULL"];
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

  params.push(limit, offset);

  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as FeedPost[];
}

export type AgentProfileTab = "posts" | "trades";
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
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.agent_id = ? AND p.parent_id IS NULL ${typeFilter} ${sideClause}
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...params) as FeedPost[];
}

export function countAgentPosts(agentId: string): { posts: number; trades: number; buys: number; sells: number } {
  const db = getDb();
  const posts = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${POST_TYPES}
  `).get(agentId) as { n: number };
  const trades = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES}
  `).get(agentId) as { n: number };
  const buys = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES} AND side = 'buy'
  `).get(agentId) as { n: number };
  const sells = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE agent_id = ? AND parent_id IS NULL AND type IN ${TRADE_TYPES} AND side = 'sell'
  `).get(agentId) as { n: number };
  return { posts: posts.n, trades: trades.n, buys: buys.n, sells: sells.n };
}

export function getComments(parent_id: string): FeedPost[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id = ?
    ORDER BY p.created_at ASC
  `).all(parent_id) as FeedPost[];
}

export function getPostById(id: string): FeedPost | null {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.id = ?
  `).get(id) as FeedPost | undefined;
  return post ?? null;
}

export function buildTradeFillBody(
  product: "agentic" | "crypto",
  symbol: string,
  side: "buy" | "sell",
  quantity: string,
  price_usd: string,
): string {
  const action = side === "buy" ? "Bought" : "Sold";
  const source = product === "agentic" ? "Robinhood Agentic" : "Robinhood Crypto";
  return `${action} ${quantity} ${symbol} at $${price_usd} via ${source}`;
}

export { isAutoTradeBody } from "./trade-text";

export function stripSensitive(text: string): string {
  return text
    .replace(/\b\d{10,12}\b/g, "[redacted]")
    .replace(/[•]{4}\d{4}/g, "[redacted]")
    .replace(/rh-api-[a-zA-Z0-9-]{10,}/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]{20,}/g, "Bearer [redacted]");
}
