import { getDb } from "./db";

export interface TradeRow {
  symbol: string;
  side: "buy" | "sell";
  quantity: string;
  price_usd: string;
  created_at: string;
}

export interface AgentPnlStats {
  realizedPnlUsd: number;
  buyCount: number;
  sellCount: number;
  totalVolumeUsd: number;
  closedTrades: number;
  wins: number;
  losses: number;
  openLots: number;
}

function parseNum(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function getAgentTradeRows(agentId: string): TradeRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT symbol, side, quantity, price_usd, created_at
    FROM posts
    WHERE agent_id = ?
      -- Copy-trades are REPLIES by design: skill.md tells agents to set
      -- parent_id on a copied fill so attribution shows on both posts. Filtering
      -- parent_id IS NULL here therefore erased every copy-trade from P&L, so an
      -- agent whose strategy is copy-trading showed zero trades and never
      -- appeared on the leaderboard at all. The type filter below already
      -- excludes comments, which is what that condition was doing.
      AND type IN ('trade_fill', 'trade_intent')
      AND symbol IS NOT NULL
      AND side IS NOT NULL
      AND quantity IS NOT NULL
      AND price_usd IS NOT NULL
    ORDER BY created_at ASC
  `).all(agentId) as TradeRow[];
}

export interface ComputePnlOptions {
  /**
   * When set, buy/sell/volume count only fills at/after this timestamp, and realized
   * P&L / win rate only attribute closes from sells in the window. FIFO lots still
   * process the full history so prior buys match today's sells correctly.
   * Expect SQLite-style UTC `YYYY-MM-DD HH:MM:SS` (or any lexicographically comparable ISO prefix).
   */
  since?: string;
}

/** UTC midnight for "today" summaries — matches SQLite `datetime('now')` posts. */
export function utcDayStart(d: Date = new Date()): string {
  return `${d.toISOString().slice(0, 10)} 00:00:00`;
}

/** FIFO realized P&L from posted trade fills (per symbol). */
export function computeAgentPnl(trades: TradeRow[], opts?: ComputePnlOptions): AgentPnlStats {
  const since = opts?.since;
  const lots = new Map<string, { qty: number; price: number }[]>();
  let realizedPnlUsd = 0;
  let buyCount = 0;
  let sellCount = 0;
  let totalVolumeUsd = 0;
  let wins = 0;
  let losses = 0;
  let closedTrades = 0;

  for (const t of trades) {
    const qty = parseNum(t.quantity);
    const price = parseNum(t.price_usd);
    if (!qty || qty <= 0 || !price || price <= 0) continue;

    const inWindow = !since || t.created_at >= since;
    const notional = qty * price;
    if (inWindow) totalVolumeUsd += notional;

    if (t.side === "buy") {
      if (inWindow) buyCount++;
      const queue = lots.get(t.symbol) ?? [];
      queue.push({ qty, price });
      lots.set(t.symbol, queue);
      continue;
    }

    if (inWindow) sellCount++;
    const queue = lots.get(t.symbol) ?? [];
    let remaining = qty;

    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0];
      const matched = Math.min(remaining, lot.qty);
      const pnl = (price - lot.price) * matched;
      if (inWindow) {
        realizedPnlUsd += pnl;
        closedTrades++;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
      }

      lot.qty -= matched;
      remaining -= matched;
      if (lot.qty <= 0.0000001) queue.shift();
    }

    lots.set(t.symbol, queue);
  }

  let openLots = 0;
  for (const queue of lots.values()) {
    openLots += queue.filter((l) => l.qty > 0).length;
  }

  return {
    realizedPnlUsd,
    buyCount,
    sellCount,
    totalVolumeUsd,
    closedTrades,
    wins,
    losses,
    openLots,
  };
}

export function formatPnl(usd: number): string {
  const sign = usd >= 0 ? "+" : "";
  return `${sign}$${usd.toFixed(2)}`;
}

export type PortfolioPeriod = "lifetime" | "today";

/** Plain-text portfolio block for Telegram/Discord (mirrors the profile panel). */
export function formatPortfolioSummary(stats: AgentPnlStats, period: PortfolioPeriod): string {
  const fills = stats.buyCount + stats.sellCount;
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;
  const title = period === "today" ? "Today (UTC)" : "Portfolio";
  const fillLabel =
    period === "today"
      ? `${fills} fill${fills !== 1 ? "s" : ""} posted today`
      : `${fills} fill${fills !== 1 ? "s" : ""} posted`;

  if (fills === 0) {
    return period === "today"
      ? `${title}\nNo fills posted today.\nFIFO from posted fills. Unrealized not included.`
      : `${title}\nNo fills posted yet.\nFIFO from posted fills. Unrealized not included.`;
  }

  const lines = [
    title,
    `${formatPnl(stats.realizedPnlUsd)} realized P&L · ${fillLabel}`,
    `Buys: ${stats.buyCount}`,
    `Sells: ${stats.sellCount}`,
    `Volume: $${stats.totalVolumeUsd.toFixed(2)}`,
  ];
  if (period === "lifetime" && stats.openLots > 0) {
    lines.push(`Open lots: ${stats.openLots}`);
  } else if (period === "today" && stats.openLots > 0) {
    lines.push(`Open lots (now): ${stats.openLots}`);
  }
  if (winRate !== null) {
    lines.push(period === "today" ? `Win rate (today): ${winRate}%` : `Win rate: ${winRate}%`);
  }
  lines.push("FIFO from posted fills. Unrealized not included.");
  return lines.join("\n");
}

export interface OpenPosition {
  symbol: string;
  qty: number;
  avgCostUsd: number;
}

/** Remaining FIFO lots after processing all trades. */
export function getOpenPositions(trades: TradeRow[]): OpenPosition[] {
  const lots = new Map<string, { qty: number; price: number }[]>();

  for (const t of trades) {
    const qty = parseNum(t.quantity);
    const price = parseNum(t.price_usd);
    if (!qty || qty <= 0 || !price || price <= 0) continue;

    if (t.side === "buy") {
      const queue = lots.get(t.symbol) ?? [];
      queue.push({ qty, price });
      lots.set(t.symbol, queue);
      continue;
    }

    const queue = lots.get(t.symbol) ?? [];
    let remaining = qty;
    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0];
      const matched = Math.min(remaining, lot.qty);
      lot.qty -= matched;
      remaining -= matched;
      if (lot.qty <= 0.0000001) queue.shift();
    }
    lots.set(t.symbol, queue);
  }

  const positions: OpenPosition[] = [];
  for (const [symbol, queue] of lots) {
    const open = queue.filter((l) => l.qty > 0);
    if (open.length === 0) continue;
    const qty = open.reduce((s, l) => s + l.qty, 0);
    const cost = open.reduce((s, l) => s + l.qty * l.price, 0);
    positions.push({ symbol, qty, avgCostUsd: cost / qty });
  }

  return positions.sort((a, b) => a.symbol.localeCompare(b.symbol));
}
