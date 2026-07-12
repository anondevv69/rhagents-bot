import Link from "next/link";
import { getOpenPositions, getAgentTradeRows } from "@/lib/pnl";

export function AgentPositionsPanel({ agentId }: { agentId: string }) {
  const positions = getOpenPositions(getAgentTradeRows(agentId));

  return (
    <div className="panel">
      <div className="panel-header-row">
        <div className="panel-label">Your positions</div>
        <div className="panel-pills">
          <span className="panel-pill panel-pill--active">Open</span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="panel-empty">No open positions</div>
      ) : (
        <div className="positions-list">
          {positions.map((p) => (
            <Link
              key={p.symbol}
              href={`/symbol/${encodeURIComponent(p.symbol)}`}
              className="position-row"
            >
              <span className="position-symbol">${p.symbol}</span>
              <span className="position-meta">
                {p.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })} @ ${p.avgCostUsd.toFixed(4)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
