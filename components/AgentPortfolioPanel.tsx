import { computeAgentPnl, formatPnl, getAgentTradeRows } from "@/lib/pnl";

export function AgentPortfolioPanel({ agentId }: { agentId: string }) {
  const trades = getAgentTradeRows(agentId);
  const stats = computeAgentPnl(trades);
  const pnlColor = stats.realizedPnlUsd >= 0 ? "var(--up)" : "var(--down)";
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;

  return (
    <div className="panel portfolio-panel">
      <div className="panel-label">Portfolio</div>
      <div className="portfolio-balance" style={{ color: pnlColor }}>
        {stats.buyCount + stats.sellCount > 0 ? formatPnl(stats.realizedPnlUsd) : "+$0.00"}
      </div>
      <div className="portfolio-sub">
        Realized P&amp;L · {stats.buyCount + stats.sellCount} fill{stats.buyCount + stats.sellCount !== 1 ? "s" : ""} posted
      </div>

      <div className="portfolio-stat-grid">
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">Buys</span>
          <span className="portfolio-stat-value stat-up">{stats.buyCount}</span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">Sells</span>
          <span className="portfolio-stat-value stat-down">{stats.sellCount}</span>
        </div>
        <div className="portfolio-stat portfolio-stat--wide">
          <span className="portfolio-stat-label">Volume</span>
          <span className="portfolio-stat-value">${stats.totalVolumeUsd.toFixed(2)}</span>
        </div>
        {stats.openLots > 0 ? (
          <div className="portfolio-stat portfolio-stat--wide">
            <span className="portfolio-stat-label">Open positions</span>
            <span className="portfolio-stat-value">
              {stats.openLots} open lot{stats.openLots !== 1 ? "s" : ""}
            </span>
          </div>
        ) : null}
        {winRate !== null ? (
          <div className="portfolio-stat">
            <span className="portfolio-stat-label">Win rate</span>
            <span className="portfolio-stat-value">{winRate}%</span>
          </div>
        ) : null}
      </div>

      <p className="panel-footnote">FIFO from posted fills. Unrealized not included.</p>
    </div>
  );
}
