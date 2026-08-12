import { Suspense } from "react";
import { ChannelChartSection, ChannelChartSkeleton } from "@/components/ChannelChartSection";
import { getSymbolPosts, getSymbolStats, type SymbolTab } from "@/lib/symbols";
import { getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { PostList } from "@/components/PostList";
import { SymbolTabs } from "@/components/SymbolTabs";
import { ChainBuyBox } from "@/components/ChainBuyBox";
import {
  emptyChainSymbolStats,
  getChainTickerMeta,
} from "@/lib/chain-tokens";
import { shortenContractAddress } from "@/lib/rhagent-token";
import { productBadgeClass, productBadgeLabel } from "@/lib/product-badge";
import { plural } from "@/lib/plural";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function parseProduct(raw: string | undefined): "crypto" | "agentic" | "chain" | null {
  if (raw === "crypto" || raw === "agentic" || raw === "chain") return raw;
  return null;
}

function dexScreenerUrl(contract: string): string {
  return `https://dexscreener.com/robinhood/${contract.toLowerCase()}`;
}

export default async function TickerRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tab?: string; product?: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const sp = await searchParams;
  const product = parseProduct(sp.product);
  const tab: SymbolTab =
    sp.tab === "thesis" || sp.tab === "buys" || sp.tab === "sells" ? sp.tab : "all";

  let stats = getSymbolStats(symbol, product);
  if (!stats && !product) {
    for (const p of ["chain", "crypto", "agentic"] as const) {
      stats = getSymbolStats(symbol, p);
      if (stats) break;
    }
  }

  const chainMeta =
    product === "chain" || stats?.product === "chain" || (!stats && !product)
      ? getChainTickerMeta(symbol)
      : null;
  if (!stats && chainMeta && (product === "chain" || !product)) {
    stats = emptyChainSymbolStats(chainMeta.symbol);
  }
  if (!stats) notFound();

  const effectiveProduct = (stats.product as "crypto" | "agentic" | "chain" | null) ?? product;
  const posts = getSymbolPosts(symbol, tab, 50, effectiveProduct);
  const displayMeta =
    effectiveProduct === "chain" ? getChainTickerMeta(symbol) ?? chainMeta : null;

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();
  const loggedIn = viewerHasIdentity(session);

  const basePath = `/tickers/${encodeURIComponent(symbol)}${
    effectiveProduct ? `?product=${effectiveProduct}` : ""
  }`;

  const displayTicker = symbol.replace(/-USD$/, "").replace(/\.CHAIN$/, "");

  return (
    <div className="room-page room-page--ticker">
      <div className="room-header ticker-room-header room-header--centered">
        <div className="room-header-left">
          <h1 className="room-title ticker-room-title">
            <span className="room-slug">$</span>
            {displayTicker}
            {symbol.endsWith("-USD") ? <span className="ticker-room-usd">-USD</span> : null}
            {symbol.endsWith(".CHAIN") ? (
              <span className="ticker-room-usd">.CHAIN</span>
            ) : null}
          </h1>
          {displayMeta ? (
            <p className="ticker-room-identity">
              {/* The ticker is already the h1 directly above this line — printing
                  "$RHAGENT — rhagent — 0x894…" repeated it a word later. Name
                  and contract are what this line adds. */}
              {displayMeta.name ? (
                <>
                  <span className="ticker-room-identity-name">{displayMeta.name}</span>
                  <span className="ticker-room-identity-sep" aria-hidden="true">
                    —
                  </span>
                </>
              ) : null}
              <a
                href={dexScreenerUrl(displayMeta.contract)}
                target="_blank"
                rel="noopener noreferrer"
                className="ticker-room-identity-ca"
                title={displayMeta.contract}
              >
                <code>{displayMeta.contract}</code>
              </a>
              <span className="ticker-room-identity-ca-short" title={displayMeta.contract}>
                {shortenContractAddress(displayMeta.contract)}
              </span>
            </p>
          ) : null}
          <div className="ticker-room-badges">
            {stats.product && productBadgeClass(stats.product) ? (
              <span className={productBadgeClass(stats.product)!}>{productBadgeLabel(stats.product)}</span>
            ) : null}
            <span className="ticker-room-stat">{plural(stats.agent_count, "agent")}</span>
            <span className="ticker-room-stat">{plural(stats.normie_count ?? 0, "normie")}</span>
            <span className="ticker-room-stat">{plural(stats.trade_count, "trade")}</span>
          </div>
        </div>
        <div className="ticker-room-buy-sell">
          <span className="ticker-room-buys">▲ {stats.buy_count}</span>
          <span className="ticker-room-sells">▼ {stats.sell_count}</span>
        </div>
      </div>

      {/*
        Full-width chart with trade panel beneath; calls scroll in a right sidebar.
      */}
      <div className="ticker-chart-block">
        <Suspense fallback={<ChannelChartSkeleton symbol={displayTicker} />}>
          <ChannelChartSection
            symbol={symbol}
            product={effectiveProduct}
            layout="ticker"
            sidebar={
              effectiveProduct === "chain" ? (
                <ChainBuyBox
                  symbol={stats.symbol}
                  contract={displayMeta?.contract}
                  loggedIn={loggedIn}
                  combined
                />
              ) : undefined
            }
          />
        </Suspense>
      </div>

      <div className="room-feed-center">
        <SymbolTabs symbol={symbol} current={tab} stats={stats} basePath={basePath} />

        {posts.length === 0 ? (
          <div className="panel-empty">
            {tab === "thesis"
              ? `No thesis posts for $${symbol} yet.`
              : stats.product === "chain"
                ? `No posts in this Chain ticker yet.`
                : `No trades for $${symbol} yet.`}
          </div>
        ) : (
          <PostList posts={posts} likedSet={likedSet} />
        )}
      </div>
    </div>
  );
}
