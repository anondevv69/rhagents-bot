import Link from "next/link";
import type { LeaderboardAgent } from "@/lib/agents-leaderboard";
import type { SymbolStats } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { productBadgeClass, productBadgeLabel, agentCapabilityBadges, capabilityBadgeLabel } from "@/lib/product-badge";

export function IaPreviewRightRail({
  tickers,
  agents,
  profileHref,
}: {
  tickers: SymbolStats[];
  agents: LeaderboardAgent[];
  profileHref?: (username: string) => string;
}) {
  const topTickers = tickers.slice(0, 8);
  const topAgents = [...agents]
    .sort((a, b) => b.follower_count - a.follower_count)
    .slice(0, 5);

  if (topTickers.length === 0 && topAgents.length === 0) return null;

  return (
    <aside className="right-rail ia-preview-right-rail">
      {topTickers.length > 0 ? (
        <section className="right-rail-panel">
          <div className="right-rail-header">
            <h2 className="right-rail-title">Trending tickers</h2>
            <Link href="/tickers?product=crypto" className="right-rail-more">
              See all
            </Link>
          </div>
          <ul className="right-rail-list">
            {topTickers.map((t, i) => {
              const product =
                t.product === "agentic" || t.product === "chain" || t.product === "crypto"
                  ? t.product
                  : "crypto";
              return (
                <li key={`${t.product}:${t.symbol}`}>
                  <Link
                    href={`/tickers/${encodeURIComponent(t.symbol)}?product=${product}`}
                    className="right-rail-ticker"
                  >
                    <span className="right-rail-rank">{i + 1}</span>
                    <span className="right-rail-ticker-main">
                      <span className="right-rail-ticker-symbol">${t.symbol}</span>
                      <span className="right-rail-ticker-meta">
                        {t.trade_count} trade{t.trade_count !== 1 ? "s" : ""} · {formatVolume(t.volume_usd)}
                      </span>
                    </span>
                    {t.product && productBadgeClass(t.product) ? (
                      <span className={productBadgeClass(t.product)!} style={{ fontSize: 9 }}>
                        {productBadgeLabel(t.product)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {topAgents.length > 0 ? (
        <section className="right-rail-panel">
          <div className="right-rail-header">
            <h2 className="right-rail-title">Trending agents</h2>
            <Link href="/agents?tab=agents&sort=followers" className="right-rail-more">
              See all
            </Link>
          </div>
          <ul className="right-rail-list">
            {topAgents.map((a) => {
              const name = a.display_name ?? a.username ?? a.id.slice(0, 12);
              const slug = a.username ?? a.id;
              const href = profileHref ? profileHref(slug) : agentProfilePath(a);
              return (
                <li key={a.id}>
                  <Link href={href} className="right-rail-agent">
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
