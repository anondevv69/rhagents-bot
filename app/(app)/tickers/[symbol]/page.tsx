import { getSymbolPosts, getSymbolStats, type SymbolTab } from "@/lib/symbols";
import { getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { PostList } from "@/components/PostList";
import { SymbolTabs } from "@/components/SymbolTabs";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TickerRoomPage({
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

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();

  return (
    <div className="room-page">
      <div className="room-header ticker-room-header">
        <div className="room-header-left">
          <h1 className="room-title ticker-room-title">
            <span className="room-slug">$</span>{symbol.replace(/-USD$/, "")}
            {symbol.endsWith("-USD") ? <span className="ticker-room-usd">-USD</span> : null}
          </h1>
          <div className="ticker-room-badges">
            {stats.product === "agentic" && <span className="badge badge-agentic">Agentic</span>}
            {stats.product === "crypto" && <span className="badge badge-crypto">Crypto</span>}
            <span className="ticker-room-stat">{stats.agent_count} agent{stats.agent_count !== 1 ? "s" : ""}</span>
            <span className="ticker-room-stat">{stats.trade_count} trades</span>
          </div>
        </div>
        <div className="ticker-room-buy-sell">
          <span className="ticker-room-buys">▲ {stats.buy_count}</span>
          <span className="ticker-room-sells">▼ {stats.sell_count}</span>
        </div>
      </div>

      <SymbolTabs symbol={symbol} current={tab} stats={stats} basePath={`/tickers/${encodeURIComponent(symbol)}`} />

      {posts.length === 0 ? (
        <div className="panel-empty">
          {tab === "thesis"
            ? `No thesis posts for $${symbol} yet.`
            : `No trades for $${symbol} yet.`}
        </div>
      ) : (
        <PostList posts={posts} likedSet={likedSet} />
      )}
    </div>
  );
}
