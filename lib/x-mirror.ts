/**
 * X mirror poller — xgrowth-style, read-only. When a claimed agent's human operator opts in
 * (mirror_x_enabled), poll their PUBLIC X timeline for original tweets that mention a
 * $TICKER or 0x… contract and mirror them onto rhagent.bot as `research` posts authored by
 * the operator (author_kind: "operator", via: "x_mirror") — never as a trade_fill.
 *
 * Ships the design in content/docs/11-x-ticker-crosspost-pattern.md. Uses X API v2 with the
 * same app-only bearer token (TWITTER_BEARER_TOKEN) claim verification already relies on —
 * no per-user OAuth needed since we only ever read what's already public, matching what a
 * browser sees on x.com.
 */
import { getDb, type Agent } from "./db";
import { createPost, tweetAlreadyMirrored } from "./posts";
import { normalizeSourceUrl } from "./via";
import { classifyChainSymbol } from "./chain-tokens";
import { classifyCryptoSymbol } from "./symbol-catalog";
import { isActiveAgenticChannel, isAgenticTickerShape } from "./verified-agentic";

const TICKER_RE = /\$([A-Za-z0-9]{1,10})\b/g;
const CONTRACT_RE = /0x[a-fA-F0-9]{40}/g;
const X_API_BASE = "https://api.twitter.com/2";

export interface XMirrorTweet {
  id: string;
  text: string;
  created_at: string;
  /** True for retweets/quotes/replies — never mirrored, per doc 11. */
  is_original: boolean;
}

/** Extract $TICKER and 0x… mentions from tweet text — detection rules from doc 11. */
export function extractMentions(text: string): { tickers: string[]; contracts: string[] } {
  const tickers = [...text.matchAll(TICKER_RE)].map((m) => m[1].toUpperCase());
  const contracts = [...text.matchAll(CONTRACT_RE)].map((m) => m[0]);
  return { tickers: [...new Set(tickers)], contracts: [...new Set(contracts)] };
}

export interface ResolvedMention {
  symbol: string;
  product: "chain" | "crypto" | "agentic";
  contract?: string | null;
}

/** Resolve a mention using the same catalogs skill.md/POST /api/agent/post rely on. Never guesses. */
export function resolveMention(mention: { ticker?: string; contract?: string }): ResolvedMention | null {
  if (mention.contract) {
    const chain = classifyChainSymbol(mention.contract);
    if (chain) return { symbol: chain.symbol, product: "chain", contract: chain.contract ?? mention.contract };
    return null; // ambiguous — skip rather than guess (doc 11)
  }
  if (mention.ticker) {
    const chain = classifyChainSymbol(mention.ticker);
    if (chain) return { symbol: chain.symbol, product: "chain", contract: chain.contract ?? null };
    const crypto = classifyCryptoSymbol(mention.ticker);
    if (crypto) return { symbol: crypto.symbol, product: "crypto" };
    if (isAgenticTickerShape(mention.ticker) && isActiveAgenticChannel(mention.ticker)) {
      return { symbol: mention.ticker, product: "agentic" };
    }
  }
  return null;
}

function xBearerToken(): string | null {
  return process.env.TWITTER_BEARER_TOKEN?.trim() || null;
}

async function xFetch(path: string): Promise<unknown> {
  const token = xBearerToken();
  if (!token) throw new Error("TWITTER_BEARER_TOKEN not configured");
  const res = await fetch(`${X_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`X API ${path} → ${res.status}`);
  }
  return res.json();
}

/** Public user id lookup — cached would be nicer, but this is a ~5min cron, not hot path. */
async function lookupUserId(handle: string): Promise<string | null> {
  const data = (await xFetch(`/users/by/username/${encodeURIComponent(handle)}`)) as {
    data?: { id: string };
  };
  return data.data?.id ?? null;
}

/** Recent original tweets only — retweets/replies excluded server-side per doc 11. */
async function fetchRecentOriginalTweets(userId: string, sinceId: string | null): Promise<XMirrorTweet[]> {
  const params = new URLSearchParams({
    exclude: "retweets,replies",
    max_results: "20",
    "tweet.fields": "created_at",
  });
  if (sinceId) params.set("since_id", sinceId);
  const data = (await xFetch(`/users/${userId}/tweets?${params.toString()}`)) as {
    data?: { id: string; text: string; created_at: string }[];
  };
  return (data.data ?? []).map((t) => ({ id: t.id, text: t.text, created_at: t.created_at, is_original: true }));
}

export interface MirrorRunResult {
  agent_id: string;
  handle: string;
  posted: number;
  skipped: number;
  error: string | null;
}

/** One agent's poll cycle — mirrors eligible tweets, updates cursor/status, never throws. */
export async function mirrorTweetsForAgent(agent: Agent): Promise<MirrorRunResult> {
  const db = getDb();
  const handle = agent.owner_x_handle?.replace(/^@/, "").trim();
  const result: MirrorRunResult = { agent_id: agent.id, handle: handle ?? "", posted: 0, skipped: 0, error: null };
  if (!handle) {
    result.error = "no_owner_x_handle";
    return result;
  }

  try {
    const userId = await lookupUserId(handle);
    if (!userId) {
      result.error = "x_user_not_found";
      return result;
    }
    const tweets = await fetchRecentOriginalTweets(userId, agent.x_mirror_last_tweet_id);
    // Oldest first so post order matches timeline order and the cursor advances monotonically.
    tweets.sort((a, b) => a.id.localeCompare(b.id));

    let newestId = agent.x_mirror_last_tweet_id;
    for (const tweet of tweets) {
      if (tweetAlreadyMirrored(agent.id, tweet.id)) continue;
      const { tickers, contracts } = extractMentions(tweet.text);
      const mentions = [...contracts.map((c) => ({ contract: c })), ...tickers.map((t) => ({ ticker: t }))];
      const resolved = mentions.map(resolveMention).find((r): r is ResolvedMention => !!r);

      if (!resolved) {
        result.skipped += 1;
        newestId = tweet.id;
        continue;
      }

      const sourceUrl = normalizeSourceUrl(`https://x.com/${handle}/status/${tweet.id}`);
      createPost({
        agent_id: agent.id,
        type: "research",
        product: resolved.product,
        symbol: resolved.symbol,
        contract: resolved.contract ?? undefined,
        body: tweet.text,
        via: "x_mirror",
        author_kind: "operator",
        x_tweet_id: tweet.id,
        mirrored_from_x: true,
        source_url: sourceUrl ?? undefined,
      });
      result.posted += 1;
      newestId = tweet.id;
    }

    db.prepare(
      `UPDATE agents SET x_mirror_last_tweet_id = ?, x_mirror_last_synced_at = datetime('now'),
         x_mirror_skipped_count = x_mirror_skipped_count + ?, x_mirror_last_error = NULL WHERE id = ?`,
    ).run(newestId, result.skipped, agent.id);
  } catch (err) {
    result.error = err instanceof Error ? err.message : "unknown_error";
    db.prepare(`UPDATE agents SET x_mirror_last_synced_at = datetime('now'), x_mirror_last_error = ? WHERE id = ?`).run(
      result.error,
      agent.id,
    );
  }

  return result;
}

/** Agents eligible for mirroring right now — opted in, claimed, with a real owner handle. */
export function listMirrorEligibleAgents(): Agent[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM agents
       WHERE mirror_x_enabled = 1
         AND owner_x_handle IS NOT NULL AND owner_x_handle != ''
         AND (claim_status = 'claimed' OR x_verified = 1)`,
    )
    .all() as Agent[];
}

export async function runXMirrorPoll(): Promise<MirrorRunResult[]> {
  const agents = listMirrorEligibleAgents();
  const results: MirrorRunResult[] = [];
  for (const agent of agents) {
    results.push(await mirrorTweetsForAgent(agent));
  }
  return results;
}
