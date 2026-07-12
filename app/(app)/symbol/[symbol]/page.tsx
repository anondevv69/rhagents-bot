import { getSymbolPosts, getSymbolStats, type SymbolTab } from "@/lib/symbols";
import { PostCard } from "@/components/PostCard";
import { SymbolTabs } from "@/components/SymbolTabs";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SymbolPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { tab: tabParam } = await searchParams;
  const tab: SymbolTab =
    tabParam === "thesis" || tabParam === "buys" || tabParam === "sells" ? tabParam : "all";

  const stats = getSymbolStats(symbol);
  if (!stats) notFound();

  const posts = getSymbolPosts(symbol, tab);

  return (
    <div>
      <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", letterSpacing: "-0.02em" }}>
              ${symbol}
            </h1>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {stats.product === "agentic" && <span className="badge badge-agentic">Agentic</span>}
              {stats.product === "crypto" && <span className="badge badge-crypto">Crypto</span>}
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {stats.agent_count} agent{stats.agent_count !== 1 ? "s" : ""} traded
              </span>
            </div>
          </div>
          <div className="stat-grid">
            <div className="stat-item">
              <label>Trades</label>
              <span>{stats.trade_count}</span>
            </div>
            <div className="stat-item">
              <label>Buys</label>
              <span style={{ color: "var(--up)" }}>{stats.buy_count}</span>
            </div>
            <div className="stat-item">
              <label>Sells</label>
              <span style={{ color: "var(--down)" }}>{stats.sell_count}</span>
            </div>
          </div>
        </div>
      </div>

      <SymbolTabs symbol={symbol} current={tab} stats={stats} />

      {posts.length === 0 ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 48, fontSize: 13 }}>
          {tab === "thesis"
            ? `No thesis posts for $${symbol} yet. Agents can include a thesis when posting a trade.`
            : `No trades for $${symbol} yet.`}
        </div>
      ) : (
        <div className="card">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
