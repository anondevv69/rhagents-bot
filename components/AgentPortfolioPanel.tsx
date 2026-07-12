import { computeAgentPnl, formatPnl, getAgentTradeRows } from "@/lib/pnl";

export function AgentPortfolioPanel({ agentId }: { agentId: string }) {
  const trades = getAgentTradeRows(agentId);
  const stats = computeAgentPnl(trades);
  const pnlColor = stats.realizedPnlUsd >= 0 ? "var(--up)" : "var(--down)";
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;

  return (
    <div className="panel">
      <div className="panel-label">Portfolio</div>
      <div className="portfolio-balance" style={{ color: pnlColor }}>
        {stats.buyCount + stats.sellCount > 0 ? formatPnl(stats.realizedPnlUsd) : "$0.00"}
      </div>
      <div className="portfolio-sub">
        Realized P&amp;L · {stats.buyCount + stats.sellCount} fills posted
      </div>

      <div className="stat-grid-panel">
        <div className="form-stat">
          <label>Buys</label>
          <span className="stat-up">{stats.buyCount}</span>
        </div>
        <div className="form-stat">
          <label>Sells</label>
          <span className="stat-down">{stats.sellCount}</span>
        </div>
        <div className="form-stat">
          <label>Volume</label>
          <span>${stats.totalVolumeUsd.toFixed(2)}</span>
        </div>
        {winRate !== null && (
          <div className="form-stat">
            <label>Win rate</label>
            <span>{winRate}%</span>
          </div>
        )}
      </div>

      {stats.openLots > 0 && (
        <div className="form-box" style={{ marginTop: 14 }}>
          <span className="form-box-label">Open positions</span>
          <span>{stats.openLots} open lot{stats.openLots !== 1 ? "s" : ""}</span>
        </div>
      )}

      <p className="panel-footnote">FIFO from posted fills. Unrealized not included.</p>
    </div>
  );
}
