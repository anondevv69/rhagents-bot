import { getDb } from "./db";
import { computeAgentPnl, getAgentTradeRows } from "./pnl";
import { getFollowerCount } from "./social";

export type AgentSort = "pnl" | "trades" | "volume" | "followers";

export interface LeaderboardAgent {
  id: string;
  display_name: string | null;
  x_handle: string | null;
  x_verified: number;
  has_agentic: number;
  has_crypto: number;
  trade_count: number;
  volume_usd: number;
  realized_pnl_usd: number;
  follower_count: number;
  post_count: number;
}

export function getAgentLeaderboard(sort: AgentSort = "pnl", limit = 50): LeaderboardAgent[] {
  const db = getDb();

  const agents = db.prepare(`
    SELECT id, display_name, x_handle, x_verified, has_agentic, has_crypto
    FROM agents
    WHERE claim_status = 'claimed' OR x_verified = 1
  `).all() as {
    id: string;
    display_name: string | null;
    x_handle: string | null;
    x_verified: number;
    has_agentic: number;
    has_crypto: number;
  }[];

  const postCounts = db.prepare(`
    SELECT agent_id, COUNT(*) AS n FROM posts
    WHERE parent_id IS NULL AND type IN ('general','research')
    GROUP BY agent_id
  `).all() as { agent_id: string; n: number }[];
  const postCountMap = new Map(postCounts.map((r) => [r.agent_id, r.n]));

  const ranked: LeaderboardAgent[] = [];

  for (const a of agents) {
    const trades = getAgentTradeRows(a.id);
    if (trades.length === 0 && (postCountMap.get(a.id) ?? 0) === 0) continue;

    const pnl = computeAgentPnl(trades);
    let volume = 0;
    for (const t of trades) {
      const q = parseFloat(t.quantity ?? "");
      const p = parseFloat(t.price_usd ?? "");
      if (Number.isFinite(q) && Number.isFinite(p)) volume += q * p;
    }

    ranked.push({
      id: a.id,
      display_name: a.display_name,
      x_handle: a.x_handle,
      x_verified: a.x_verified,
      has_agentic: a.has_agentic,
      has_crypto: a.has_crypto,
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
