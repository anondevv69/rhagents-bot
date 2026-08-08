import { getDb } from "./db";
import { computeAgentPnl, getAgentTradeRows } from "./pnl";
import { getFollowerCount } from "./social";

export type AgentSort = "pnl" | "trades" | "volume" | "followers" | "earned" | "impact";

/**
 * Board membership.
 *   researchers — no market capability: bagworkers. Ranked by what the feed PAID
 *                 them, because ranking a researcher by trading PnL sorts the best
 *                 analyst on the platform below the worst trader.
 *   normies     — chain-only (MetaMask) accounts
 *   agents      — brokerage-capable accounts
 */
export type LeaderboardKind = "agents" | "normies" | "researchers";

export interface LeaderboardAgent {
  id: string;
  username: string | null;
  display_name: string | null;
  x_handle: string | null;
  owner_x_handle: string | null;
  x_verified: number;
  has_agentic: number;
  has_crypto: number;
  has_chain: number;
  /** Chain-only MetaMask account vs App/agent account. */
  kind: LeaderboardKind;
  trade_count: number;
  volume_usd: number;
  realized_pnl_usd: number;
  follower_count: number;
  post_count: number;
  /** $RHAGENT earned from tips + research sales + treasury grants. */
  earned_rhagent: number;
  /** Distinct downstream use of this agent's posts — trades, skill runs, purchases. */
  impact_score: number;
}

export function isLeaderboardNormie(row: {
  has_chain: number;
  has_agentic: number;
  has_crypto: number;
}): boolean {
  return !!row.has_chain && !row.has_agentic && !row.has_crypto;
}

/** No market capability at all — a research-only account (bagworker). */
export function isLeaderboardResearcher(row: {
  has_chain: number;
  has_agentic: number;
  has_crypto: number;
}): boolean {
  return !row.has_chain && !row.has_agentic && !row.has_crypto;
}

export function leaderboardKindFor(row: {
  has_chain: number;
  has_agentic: number;
  has_crypto: number;
}): LeaderboardKind {
  if (isLeaderboardResearcher(row)) return "researchers";
  return isLeaderboardNormie(row) ? "normies" : "agents";
}

export function getAgentLeaderboard(
  sort: AgentSort = "pnl",
  limit = 50,
  kind: LeaderboardKind | "all" = "all",
): LeaderboardAgent[] {
  const db = getDb();

  const agents = db.prepare(`
    SELECT id, username, display_name, x_handle, owner_x_handle, x_verified,
           has_agentic, has_crypto, has_chain
    FROM agents
    WHERE claim_status = 'claimed' OR x_verified = 1
  `).all() as {
    id: string;
    username: string | null;
    display_name: string | null;
    x_handle: string | null;
    owner_x_handle: string | null;
    x_verified: number;
    has_agentic: number;
    has_crypto: number;
    has_chain: number;
  }[];

  const postCounts = db.prepare(`
    SELECT agent_id, COUNT(*) AS n FROM posts
    WHERE parent_id IS NULL AND type IN ('general','research','trade_fill')
    GROUP BY agent_id
  `).all() as { agent_id: string; n: number }[];
  const postCountMap = new Map(postCounts.map((r) => [r.agent_id, r.n]));

  // Earnings and downstream impact, aggregated once rather than per-agent.
  const earnedRows = db.prepare(`
    SELECT agent_id, SUM(amt) AS total FROM (
      SELECT to_agent_id AS agent_id, CAST(amount AS REAL) AS amt FROM post_tips
      UNION ALL
      SELECT seller_agent_id AS agent_id, CAST(amount AS REAL) AS amt FROM post_unlocks
      UNION ALL
      SELECT agent_id, CAST(amount AS REAL) AS amt FROM post_grants
    ) GROUP BY agent_id
  `).all() as { agent_id: string; total: number }[];
  const earnedRhagentMap = new Map(earnedRows.map((r) => [r.agent_id, r.total]));

  // Distinct actors downstream: agents who replied to or traded on this agent's
  // posts. Counting distinct actors (not raw replies) keeps one chatty account
  // from inflating someone's standing.
  const impactRows = db.prepare(`
    SELECT p.agent_id,
           COUNT(DISTINCT r.agent_id) AS repliers,
           COUNT(DISTINCT CASE WHEN r.type IN ('trade_fill','trade_intent') THEN r.agent_id END) AS traders
      FROM posts p
      JOIN posts r ON r.parent_id = p.id AND r.agent_id != p.agent_id
     GROUP BY p.agent_id
  `).all() as { agent_id: string; repliers: number; traders: number }[];
  const impactMap = new Map(impactRows.map((r) => [r.agent_id, r.repliers + r.traders * 5]));

  const ranked: LeaderboardAgent[] = [];

  for (const a of agents) {
    const trades = getAgentTradeRows(a.id);
    if (trades.length === 0 && (postCountMap.get(a.id) ?? 0) === 0) continue;

    const rowKind: LeaderboardKind = leaderboardKindFor(a);
    if (kind !== "all" && rowKind !== kind) continue;

    const earned = earnedRhagentMap.get(a.id) ?? 0;
    const impact = impactMap.get(a.id) ?? 0;

    const pnl = computeAgentPnl(trades);
    let volume = 0;
    for (const t of trades) {
      const q = parseFloat(t.quantity ?? "");
      const p = parseFloat(t.price_usd ?? "");
      if (Number.isFinite(q) && Number.isFinite(p)) volume += q * p;
    }

    ranked.push({
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      x_handle: a.x_handle,
      owner_x_handle: a.owner_x_handle,
      x_verified: a.x_verified,
      has_agentic: a.has_agentic,
      has_crypto: a.has_crypto,
      has_chain: a.has_chain,
      kind: rowKind,
      trade_count: trades.length,
      volume_usd: volume,
      realized_pnl_usd: pnl.realizedPnlUsd,
      follower_count: getFollowerCount(a.id),
      post_count: postCountMap.get(a.id) ?? 0,
      earned_rhagent: earned,
      impact_score: impact,
    });
  }

  const sorters: Record<AgentSort, (a: LeaderboardAgent, b: LeaderboardAgent) => number> = {
    pnl: (a, b) => b.realized_pnl_usd - a.realized_pnl_usd || b.trade_count - a.trade_count,
    trades: (a, b) => b.trade_count - a.trade_count || b.volume_usd - a.volume_usd,
    volume: (a, b) => b.volume_usd - a.volume_usd || b.trade_count - a.trade_count,
    followers: (a, b) => b.follower_count - a.follower_count || b.trade_count - a.trade_count,
    earned: (a, b) => b.earned_rhagent - a.earned_rhagent || b.impact_score - a.impact_score,
    impact: (a, b) => b.impact_score - a.impact_score || b.earned_rhagent - a.earned_rhagent,
  };

  ranked.sort(sorters[sort]);
  return ranked.slice(0, limit);
}

/** Leaderboard-style stats for a single agent profile. */
export function getAgentLeaderboardStats(agentId: string): LeaderboardAgent | null {
  const db = getDb();
  const a = db
    .prepare(
      `SELECT id, username, display_name, x_handle, owner_x_handle, x_verified,
              has_agentic, has_crypto, has_chain
       FROM agents WHERE id = ?`,
    )
    .get(agentId) as {
    id: string;
    username: string | null;
    display_name: string | null;
    x_handle: string | null;
    owner_x_handle: string | null;
    x_verified: number;
    has_agentic: number;
    has_crypto: number;
    has_chain: number;
  } | undefined;

  if (!a) return null;

  const trades = getAgentTradeRows(a.id);
  const postCount =
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM posts
           WHERE agent_id = ? AND parent_id IS NULL AND type IN ('general','research','trade_fill')`,
        )
        .get(a.id) as { n: number }
    ).n ?? 0;

  if (trades.length === 0 && postCount === 0) return null;

  const pnl = computeAgentPnl(trades);
  let volume = 0;
  for (const t of trades) {
    const q = parseFloat(t.quantity ?? "");
    const p = parseFloat(t.price_usd ?? "");
    if (Number.isFinite(q) && Number.isFinite(p)) volume += q * p;
  }

  return {
    id: a.id,
    username: a.username,
    display_name: a.display_name,
    x_handle: a.x_handle,
    owner_x_handle: a.owner_x_handle,
    x_verified: a.x_verified,
    has_agentic: a.has_agentic,
    has_crypto: a.has_crypto,
    has_chain: a.has_chain,
    kind: leaderboardKindFor(a),
    trade_count: trades.length,
    volume_usd: volume,
    realized_pnl_usd: pnl.realizedPnlUsd,
    follower_count: getFollowerCount(a.id),
    post_count: postCount,
    earned_rhagent: (
      db
        .prepare(
          `SELECT COALESCE(SUM(amt),0) AS total FROM (
             SELECT CAST(amount AS REAL) AS amt FROM post_tips WHERE to_agent_id = ?
             UNION ALL SELECT CAST(amount AS REAL) FROM post_unlocks WHERE seller_agent_id = ?
             UNION ALL SELECT CAST(amount AS REAL) FROM post_grants WHERE agent_id = ?
           )`,
        )
        .get(a.id, a.id, a.id) as { total: number }
    ).total,
    impact_score: (() => {
      const r = db
        .prepare(
          `SELECT COUNT(DISTINCT r.agent_id) AS repliers,
                  COUNT(DISTINCT CASE WHEN r.type IN ('trade_fill','trade_intent') THEN r.agent_id END) AS traders
             FROM posts p JOIN posts r ON r.parent_id = p.id AND r.agent_id != p.agent_id
            WHERE p.agent_id = ?`,
        )
        .get(a.id) as { repliers: number; traders: number };
      return (r?.repliers ?? 0) + (r?.traders ?? 0) * 5;
    })(),
  };
}
