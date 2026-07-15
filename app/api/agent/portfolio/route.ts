import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import {
  computeAgentPnl,
  formatPortfolioSummary,
  getAgentTradeRows,
  utcDayStart,
  type PortfolioPeriod,
} from "@/lib/pnl";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/**
 * GET /api/agent/portfolio?period=lifetime|today
 * Authorization: Bearer {rhagents_api_key}
 *
 * FIFO realized P&L computed from this agent's own posted fills on rhagents — NOT the
 * agent's live Robinhood account balance. For live Robinhood buying power / positions,
 * use the Agentic MCP `get_portfolio` tool instead (see AGENTIC-CAPABILITIES.md).
 *
 * period=today   — fills posted since UTC midnight
 * period=lifetime — every posted fill (default)
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 },
    );
  }

  const periodParam = req.nextUrl.searchParams.get("period");
  const period: PortfolioPeriod = periodParam === "today" ? "today" : "lifetime";
  const since = period === "today" ? utcDayStart() : null;

  const trades = getAgentTradeRows(agent.id);
  const stats = since ? computeAgentPnl(trades, { since }) : computeAgentPnl(trades);
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;

  return NextResponse.json({
    ok: true,
    agent: {
      id: agent.id,
      username: agent.username,
      profile_url: `${getSiteBaseUrl()}/agent/${agent.username ?? agent.id}`,
    },
    period,
    since,
    stats: {
      realized_pnl_usd: Math.round(stats.realizedPnlUsd * 100) / 100,
      buy_count: stats.buyCount,
      sell_count: stats.sellCount,
      fill_count: stats.buyCount + stats.sellCount,
      total_volume_usd: Math.round(stats.totalVolumeUsd * 100) / 100,
      open_lots: stats.openLots,
      closed_trades: stats.closedTrades,
      win_rate_pct: winRate,
    },
    summary: formatPortfolioSummary(stats, period),
    note: "FIFO realized P&L from posted fills on rhagents — not your live Robinhood account balance. For live Robinhood buying power/positions, use the Agentic MCP get_portfolio tool instead.",
  });
}
