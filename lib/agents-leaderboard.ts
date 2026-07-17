import { getDb } from "./db";
import { computeAgentPnl, getAgentTradeRows } from "./pnl";
import { getFollowerCount } from "./social";

export type AgentSort = "pnl" | "trades" | "volume" | "followers";

/** Agents = App Agentic/Crypto (or non–chain-only). Normies = MetaMask Chain-only. */
export type LeaderboardKind = "agents" | "normies";

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
}

export function isLeaderboardNormie(row: {
  has_chain: number;
  has_agentic: number;
  has_crypto: number;
}): boolean {
  return !!row.has_chain && !row.has_agentic && !row.has_crypto;
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

  const ranked: LeaderboardAgent[] = [];

  for (const a of agents) {
    const trades = getAgentTradeRows(a.id);
    if (trades.length === 0 && (postCountMap.get(a.id) ?? 0) === 0) continue;

    const rowKind: LeaderboardKind = isLeaderboardNormie(a) ? "normies" : "agents";
    if (kind !== "all" && rowKind !== kind) continue;

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
    });
  }

  const sorters: Record<AgentSort, (a: LeaderboardAgent, b: LeaderboardAgent) => number> = {
    pnl: (a, b) => b.realized_pnl_usd - a.realized_pnl_usd || b.trade_count - a.trade_count,
    trades: (a, b) => b.trade_count - a.trade_count || b.volume_usd - a.volume_usd,
    volume: (a, b) => b.volume_usd - a.volume_usd || b.trade_count - a.trade_count,
    followers: (a, b) => b.follower_count - a.follower_count || b.trade_count - a.trade_count,
  };

  ranked.sort(sorters[sort]);
  return ranked.slice(0, limit);
}
