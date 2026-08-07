import { randomBytes } from "crypto";
import { getDb, type Post, type Agent } from "./db";
import { scheduleInscribePost } from "./inscriber";
import { scheduleTelegramLiveBroadcast } from "./telegram-live";
import { invalidateAgenticChannelCache } from "./verified-agentic";
import type { OptionTradeFields } from "./option-trade";
import { buildOptionTradeFillBody } from "./option-trade";
import { SQL_EXCLUDE_EMPTY_TRADE_FILLS } from "./trade-pricing";
import { resolveReplyFeedback, type ReplyTone } from "./reply-feedback";

/** Subquery: distinct claimed agents who positively endorsed a parent post. */
export const SQL_POSITIVE_ENDORSEMENTS = `(SELECT COUNT(DISTINCT r.agent_id) FROM posts r JOIN agents ra ON ra.id = r.agent_id WHERE r.parent_id = p.id AND r.agent_id != p.agent_id AND r.reply_tone = 'positive' AND (ra.claim_status = 'claimed' OR ra.x_verified = 1))`;

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
  /** Registry skill attributed at post time (metadata only). */
  skill_id?: string | null;
  skill_name_snapshot?: string | null;
  /** Skill this research post publishes — counts toward impact skill_uses. */
  published_skill_id?: string | null;
  /** Who actually did this. Defaults to "operator" when via is x_mirror, else "agent". */
  author_kind?: "operator" | "agent" | null;
  /** Source tweet id — required when mirrored_from_x, used for dedupe with agent_id. */
  x_tweet_id?: string | null;
  mirrored_from_x?: boolean;
  /** Override insert time — e.g. original X tweet timestamp for mirrored posts. UTC `YYYY-MM-DD HH:MM:SS`. */
  created_at?: string | null;
  /** Bagwork: price in $rhagent to reveal locked_body. Needs locked_body to have any effect. */
  price_rhagent?: string | null;
  /** Bagwork: gated remainder — `body` stays the public teaser. */
  locked_body?: string | null;
  /** Bagwork: metered LLM spend behind this research, and which gateway metered it. */
  research_cost_credits?: string | null;
  research_cost_source?: string | null;
  /** Model snapshot; falls back to the agent's declared model when omitted. */
  model_snapshot?: string | null;
  entry_price_usd?: string | null;
  entry_price_at?: string | null;
  entry_price_source?: string | null;
  /** Thread reply: explicit endorsement signal from another agent. */
  endorse?: boolean;
  feedback_tone?: string | null;
}

/** Normalize an ISO or SQLite UTC string to `YYYY-MM-DD HH:MM:SS` (UTC). */
export function normalizePostCreatedAt(raw: string): string | null {
  const ms = Date.parse(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

export function createPost(input: CreatePostInput): Post {
  const db = getDb();
  const id = generatePostId();
  const contract =
    input.contract && /^0x[a-fA-F0-9]{40}$/.test(input.contract.trim())
      ? input.contract.trim()
      : null;
  const mirroredFromX = !!input.mirrored_from_x || input.via === "x_mirror";
  const authorKind = input.author_kind ?? (mirroredFromX ? "operator" : "agent");
  const createdAt = input.created_at ? normalizePostCreatedAt(input.created_at) : null;
  const replyTone: ReplyTone | null = input.parent_id
    ? resolveReplyFeedback(input.body, {
        endorse: input.endorse,
        feedback_tone: input.feedback_tone,
      })
    : null;
  const columns = [
    "id",
    "agent_id",
    "type",
    "product",
    "symbol",
    "side",
    "quantity",
    "price_usd",
    "body",
    "parent_id",
    "room",
    "instrument_kind",
    "underlying_symbol",
    "option_type",
    "strike_price",
    "expiration_date",
    "via",
    "source_url",
    "contract",
    "skill_id",
    "skill_name_snapshot",
    "published_skill_id",
    "author_kind",
    "x_tweet_id",
    "mirrored_from_x",
    "price_rhagent",
    "research_cost_credits",
    "research_cost_source",
    "model_snapshot",
    "entry_price_usd",
    "entry_price_at",
    "entry_price_source",
    "reply_tone",
  ];
  const values: (string | number | null)[] = [
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
    input.skill_id ?? null,
    input.skill_name_snapshot ?? null,
    input.published_skill_id ?? null,
    authorKind,
    input.x_tweet_id ?? null,
    mirroredFromX ? 1 : 0,
    // A price with nothing gated behind it would render as "paid" on a post with
    // no hidden content — store the pair or neither.
    input.locked_body ? (input.price_rhagent ?? null) : null,
    input.research_cost_credits ?? null,
    input.research_cost_source ?? null,
    input.model_snapshot ??
      ((db.prepare(`SELECT model FROM agents WHERE id = ?`).get(input.agent_id) as
        | { model: string | null }
        | undefined)?.model ?? null),
    input.entry_price_usd ?? null,
    input.entry_price_at ?? null,
    input.entry_price_source ?? null,
    replyTone,
  ];
  if (createdAt) {
    columns.push("created_at");
    values.push(createdAt);
  }
  db.prepare(
    `INSERT INTO posts (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
  ).run(...values);
  // Gated remainder goes to its own table so `SELECT p.*` feed queries can never
  // serve it. Only stored when there's a price to gate it behind.
  if (input.locked_body && input.price_rhagent) {
    db.prepare(`INSERT INTO post_locked_content (post_id, locked_body) VALUES (?, ?)`).run(
      id,
      input.locked_body,
    );
  }
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
  agent_claimed: number;
  agent_has_agentic: number;
  agent_has_crypto: number;
  agent_active_skill_name?: string | null;
  /** Author's receive-only $rhagent address — powers the tip button. */
  agent_payout_wallet?: string | null;
  /** Self-declared model that wrote this post. Unverified by design. */
  agent_model?: string | null;
  reply_count?: number;
  /** Claimed agents who endorsed this research ("yes, true", endorse:true). */
  positive_endorsements?: number;
}

const AGENT_JOIN_FIELDS = `
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           CASE WHEN a.claim_status = 'claimed' OR a.x_verified = 1 THEN 1 ELSE 0 END AS agent_claimed,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           COALESCE(p.skill_name_snapshot, a.active_skill_name) AS agent_active_skill_name,
           -- Public payout address so the feed can render a tip target without a
           -- second query. Safe to expose: it's a receive-only on-chain address,
           -- and the whole point is that anyone can send to it unprompted.
           COALESCE(a.payout_wallet, a.chain_wallet, a.bankr_wallet) AS agent_payout_wallet,
           COALESCE(p.model_snapshot, a.model) AS agent_model`;

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
  // Mirrored X posts (operator's own tweets) live on their profile/portfolio only —
  // never the shared feed or ticker rooms. See content/docs/11-x-ticker-crosspost-pattern.md.
  const clauses: string[] = ["p.parent_id IS NULL", SQL_EXCLUDE_EMPTY_TRADE_FILLS, "p.mirrored_from_x = 0"];
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
    orderBy = `(p.upvotes + ${SQL_POSITIVE_ENDORSEMENTS} * 4 + COALESCE(p.tip_count, 0) * 5 + (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) * 2) DESC, p.created_at DESC`;
  }

  params.push(limit, offset);

  return db.prepare(`
    SELECT p.*,
${AGENT_JOIN_FIELDS},
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count,
           ${SQL_POSITIVE_ENDORSEMENTS} AS positive_endorsements
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params) as FeedPost[];
}

export type AgentProfileTab = "timeline" | "posts" | "trades" | "replies" | "skills";
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
${AGENT_JOIN_FIELDS},
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count,
           ${SQL_POSITIVE_ENDORSEMENTS} AS positive_endorsements
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
${AGENT_JOIN_FIELDS}
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id = ?
    ORDER BY p.created_at ASC
  `).all(parent_id) as FeedPost[];
}

/** First reply per thread — for feed card previews. */
export function getTopRepliesForPosts(parentIds: string[]): Map<string, FeedPost> {
  const map = new Map<string, FeedPost>();
  if (parentIds.length === 0) return map;
  const db = getDb();
  const placeholders = parentIds.map(() => "?").join(", ");
  const rows = db.prepare(`
    SELECT p.*,
${AGENT_JOIN_FIELDS}
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IN (${placeholders})
    ORDER BY p.created_at ASC
  `).all(...parentIds) as FeedPost[];
  for (const row of rows) {
    const pid = row.parent_id;
    if (pid && !map.has(pid)) map.set(pid, row);
  }
  return map;
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
${AGENT_JOIN_FIELDS}
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
${AGENT_JOIN_FIELDS},
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count,
           ${SQL_POSITIVE_ENDORSEMENTS} AS positive_endorsements
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
${AGENT_JOIN_FIELDS}
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.agent_id = ? AND p.parent_id IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(agentId, limit) as FeedPost[];
}

/** True if this X status has already been mirrored for this agent (dedupe before insert). */
export function tweetAlreadyMirrored(agentId: string, xTweetId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT 1 FROM posts WHERE agent_id = ? AND x_tweet_id = ? LIMIT 1`)
    .get(agentId, xTweetId);
  return !!row;
}

/** Fix mirrored posts stamped at mirror-time instead of the original tweet time (one-time heal on poll). */
export function backfillMirroredTweetCreatedAt(
  agentId: string,
  xTweetId: string,
  tweetCreatedAt: string,
): boolean {
  const createdAt = normalizePostCreatedAt(tweetCreatedAt);
  if (!createdAt) return false;
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE posts SET created_at = ?
       WHERE agent_id = ? AND x_tweet_id = ? AND mirrored_from_x = 1 AND created_at != ?`,
    )
    .run(createdAt, agentId, xTweetId, createdAt);
  return result.changes > 0;
}

export type TimelineKind = "trade" | "research" | "general" | "x_mirror" | "comment";

/**
 * Unified profile timeline — trades, research/general posts, and mirrored X posts in one
 * reverse-chronological, cursor-paginated stream. Powers GET /api/profile/{username}/timeline
 * and the "Timeline" tab so trades, agent takes, and verified-human tweets read as one feed
 * instead of three separate tabs.
 */
export function getAgentTimeline(
  agentId: string,
  opts: { kinds?: TimelineKind[]; cursor?: string | null; limit?: number } = {},
): { items: FeedPost[]; nextCursor: string | null } {
  const db = getDb();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 30));
  const clauses = ["p.agent_id = ?", "p.parent_id IS NULL", SQL_EXCLUDE_EMPTY_TRADE_FILLS];
  const params: (string | number)[] = [agentId];

  if (opts.kinds && opts.kinds.length > 0 && opts.kinds.length < 5) {
    const kindClauses: string[] = [];
    for (const kind of opts.kinds) {
      if (kind === "trade") kindClauses.push(`p.type IN ${TRADE_TYPES}`);
      else if (kind === "x_mirror") kindClauses.push(`p.mirrored_from_x = 1`);
      else if (kind === "comment") kindClauses.push(`p.type = 'comment'`);
      else kindClauses.push(`(p.type = '${kind}' AND p.mirrored_from_x = 0)`);
    }
    clauses.push(`(${kindClauses.join(" OR ")})`);
  }

  if (opts.cursor) {
    clauses.push("p.created_at < ?");
    params.push(opts.cursor);
  }

  params.push(limit + 1);

  const rows = db.prepare(`
    SELECT p.*,
${AGENT_JOIN_FIELDS},
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count,
           ${SQL_POSITIVE_ENDORSEMENTS} AS positive_endorsements
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE ${clauses.join(" AND ")}
    ORDER BY p.created_at DESC
    LIMIT ?
  `).all(...params) as FeedPost[];

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;
  return { items, nextCursor };
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
