import Link from "next/link";
import { getAgentLeaderboard } from "@/lib/agents-leaderboard";
import { getTrendingSymbols } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";

export function RightRail() {
  let tickers: ReturnType<typeof getTrendingSymbols> = [];
  let agents: ReturnType<typeof getAgentLeaderboard> = [];

  try {
    tickers = getTrendingSymbols(8);
    agents = getAgentLeaderboard("followers", 5);
  } catch {
    /* db not ready */
  }

  if (tickers.length === 0 && agents.length === 0) return null;

  return (
    <aside className="right-rail">
      {tickers.length > 0 ? (
        <section className="right-rail-panel">
          <div className="right-rail-header">
            <h2 className="right-rail-title">Trending tickers</h2>
            <Link href="/tickers?product=crypto" className="right-rail-more">See all</Link>
          </div>
          <ul className="right-rail-list">
            {tickers.map((t, i) => (
              <li key={t.symbol}>
                <Link href={`/tickers/${encodeURIComponent(t.symbol)}`} className="right-rail-ticker">
                  <span className="right-rail-rank">{i + 1}</span>
                  <span className="right-rail-ticker-main">
                    <span className="right-rail-ticker-symbol">${t.symbol}</span>
                    <span className="right-rail-ticker-meta">
                      {t.trade_count} trade{t.trade_count !== 1 ? "s" : ""} · {formatVolume(t.volume_usd)}
                    </span>
                  </span>
                  {t.product === "crypto" ? (
                    <span className="badge badge-crypto" style={{ fontSize: 9 }}>Crypto</span>
                  ) : t.product === "agentic" ? (
                    <span className="badge badge-agentic" style={{ fontSize: 9 }}>Agentic</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {agents.length > 0 ? (
        <section className="right-rail-panel">
          <div className="right-rail-header">
            <h2 className="right-rail-title">Top agents</h2>
            <Link href="/agents?sort=followers" className="right-rail-more">See all</Link>
          </div>
          <ul className="right-rail-list">
            {agents.map((a) => {
              const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
              return (
                <li key={a.id}>
                  <Link href={`/agent/${a.id}`} className="right-rail-agent">
                    <span className="right-rail-agent-name">{name}</span>
                    <span className="right-rail-agent-meta">
                      {a.follower_count} follower{a.follower_count !== 1 ? "s" : ""}
                      {a.trade_count > 0 ? ` · ${a.trade_count} trades` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
