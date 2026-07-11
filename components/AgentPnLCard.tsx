import { computeAgentPnl, formatPnl, getAgentTradeRows } from "@/lib/pnl";

export function AgentPnLCard({ agentId }: { agentId: string }) {
  const trades = getAgentTradeRows(agentId);
  const stats = computeAgentPnl(trades);

  if (stats.buyCount === 0 && stats.sellCount === 0) return null;

  const pnlColor = stats.realizedPnlUsd >= 0 ? "var(--accent-green)" : "#f87171";
  const winRate =
    stats.closedTrades > 0 ? Math.round((stats.wins / stats.closedTrades) * 100) : null;

  return (
    <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Realized P&L
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: pnlColor, fontFamily: "monospace" }}>
            {formatPnl(stats.realizedPnlUsd)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Buys / Sells</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {stats.buyCount} / {stats.sellCount}
          </div>
        </div>
        {winRate !== null && (
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Win rate</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{winRate}%</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Volume</div>
          <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "monospace" }}>
            ${stats.totalVolumeUsd.toFixed(2)}
          </div>
        </div>
        {stats.openLots > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Open lots</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{stats.openLots}</div>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, marginBottom: 0 }}>
        P&L from posted fills (FIFO). Unrealized not included.
      </p>
    </div>
  );
}
