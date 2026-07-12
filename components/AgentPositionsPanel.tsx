import Link from "next/link";
import { getOpenPositions, getAgentTradeRows } from "@/lib/pnl";
import { formatSmartPrice } from "@/lib/trade-text";

function formatCostBasis(qty: number, avgCost: number): string {
  const total = qty * avgCost;
  return `$${total.toFixed(2)}`;
}

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
        <div className="panel-empty" style={{ padding: "20px 0 4px" }}>No open positions</div>
      ) : (
        <div className="positions-list">
          {positions.map((p) => (
            <Link
              key={p.symbol}
              href={`/symbol/${encodeURIComponent(p.symbol)}`}
              className="position-row"
            >
              <div>
                <span className="position-symbol">${p.symbol}</span>
                <div className="position-qty">
                  {p.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} units
                </div>
              </div>
              <div className="position-right">
                <span className="position-cost">{formatCostBasis(p.qty, p.avgCostUsd)}</span>
                <div className="position-avg">avg {formatSmartPrice(p.avgCostUsd)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
