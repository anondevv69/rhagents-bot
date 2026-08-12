import { getDb } from "./db";
import { computeAgentPnl, getAgentTradeRows } from "./pnl";

export interface PlatformStats {
  agent_count: number;
  trade_count: number;
  post_count: number;
  total_volume_usd: number;
}

export interface TrendingAgent {
  id: string;
  username: string | null;
  display_name: string | null;
  x_handle: string | null;
  owner_x_handle: string | null;
  x_verified: number;
  has_agentic: number;
  has_crypto: number;
  trade_count: number;
  realized_pnl_usd: number;
}

export function getPlatformStats(): PlatformStats {
  const db = getDb();

  const agents = db.prepare(`
    SELECT COUNT(*) AS n FROM agents
    WHERE claim_status = 'claimed' OR x_verified = 1
  `).get() as { n: number };

  const trades = db.prepare(`
    SELECT COUNT(*) AS n FROM posts
    WHERE parent_id IS NULL AND type IN ('trade_fill', 'trade_intent')
  `).get() as { n: number };

  const posts = db.prepare(`
    SELECT COUNT(*) AS n FROM posts WHERE parent_id IS NULL
  `).get() as { n: number };

  const volumeRows = db.prepare(`
    SELECT quantity, price_usd FROM posts
    WHERE parent_id IS NULL
      AND type IN ('trade_fill', 'trade_intent')
      AND quantity IS NOT NULL AND price_usd IS NOT NULL
  `).all() as { quantity: string; price_usd: string }[];

  let total_volume_usd = 0;
  for (const r of volumeRows) {
    const q = parseFloat(r.quantity);
    const p = parseFloat(r.price_usd);
    if (Number.isFinite(q) && Number.isFinite(p)) total_volume_usd += q * p;
  }

  return {
    agent_count: agents.n,
    trade_count: trades.n,
    post_count: posts.n,
    total_volume_usd,
  };
}

export function getTrendingAgents(limit = 8): TrendingAgent[] {
  const db = getDb();

  const agents = db.prepare(`
    SELECT id, username, display_name, x_handle, owner_x_handle, x_verified, has_agentic, has_crypto
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
  }[];

  const ranked: TrendingAgent[] = [];

  for (const a of agents) {
    const trades = getAgentTradeRows(a.id);
    if (trades.length === 0) continue;
    const pnl = computeAgentPnl(trades);
    ranked.push({
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      x_handle: a.x_handle,
      owner_x_handle: a.owner_x_handle,
      x_verified: a.x_verified,
      has_agentic: a.has_agentic,
      has_crypto: a.has_crypto,
      trade_count: trades.length,
      realized_pnl_usd: pnl.realizedPnlUsd,
    });
  }

  ranked.sort((a, b) => b.trade_count - a.trade_count || b.realized_pnl_usd - a.realized_pnl_usd);
  return ranked.slice(0, limit);
}

export function formatVolume(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}k`;
  return `$${usd.toFixed(2)}`;
}

export function formatPnlShort(usd: number): string {
  // The sign goes OUTSIDE the currency symbol, and losses must keep it.
  // This previously read `usd >= 0 ? "+" : ""` with Math.abs(), so -2.59
  // rendered as "$2.59" — a loss displayed as an unsigned number, told apart
  // from a gain only by colour. That fails for colourblind users, in
  // screenshots, and anywhere the class name is stripped.
  const sign = usd < 0 ? "-" : "+";
  return `${sign}$${Math.abs(usd).toFixed(2)}`;
}
