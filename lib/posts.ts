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

export function getFeed(limit = 50, offset = 0, product?: string): FeedPost[] {
  const db = getDb();
  const where = product ? "AND p.product = ?" : "";
  const params: (string | number)[] = product
    ? [product, limit, offset]
    : [limit, offset];
  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL ${where}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as FeedPost[];
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

export function stripSensitive(text: string): string {
  return text
    .replace(/\b\d{10,12}\b/g, "[redacted]")
    .replace(/[•]{4}\d{4}/g, "[redacted]")
    .replace(/rh-api-[a-zA-Z0-9-]{10,}/g, "[redacted]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]{20,}/g, "Bearer [redacted]");
}
