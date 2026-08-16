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
  listOpenedChainSymbols,
} from "@/lib/chain-tokens";
import { emptyRwaSymbolStats } from "@/lib/rwa-directory";
import { rwaTokenFor } from "@/lib/rwa-tokens";
import { fetchDexPairSnapshot, formatCompactUsd } from "@/lib/dex-pair";
import { formatSmartPrice } from "@/lib/trade-text";
import { shortenContractAddress } from "@/lib/rhagent-token";
import { productBadgeClass, productBadgeLabel } from "@/lib/product-badge";
import { plural } from "@/lib/plural";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type RoomProduct = "crypto" | "agentic" | "chain" | "rwa";

function parseProduct(raw: string | undefined): RoomProduct | null {
  if (raw === "crypto" || raw === "agentic" || raw === "chain" || raw === "rwa") return raw;
  if (raw === "stocks") return "agentic";
  return null;
}

/** Posts for RWA rooms are stored as agentic today. */
function postsProduct(product: RoomProduct | null): "crypto" | "agentic" | "chain" | null {
  if (product === "rwa") return "agentic";
  return product;
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
  const tab: SymbolTab = sp.tab === "thesis" ? "thesis" : "swaps";

  const statsProduct = postsProduct(product);
  let stats = getSymbolStats(symbol, statsProduct);
  if (!stats && !product) {
    for (const p of ["chain", "crypto", "agentic"] as const) {
      stats = getSymbolStats(symbol, p);
      if (stats) break;
    }
  }

  // RWA lane: always-open room from RHJ registry (even with zero posts).
  const rwaMeta =
    product === "rwa" || (!stats && !product) ? await rwaTokenFor(symbol) : null;
  if (!stats && rwaMeta && (product === "rwa" || !product)) {
    stats = emptyRwaSymbolStats(rwaMeta.symbol);
  }

  // Chain lane: empty room only if an agent opened it (chain_tickers) — not seed alone.
  const chainOpened =
    product === "chain" || stats?.product === "chain" || (!stats && !product)
      ? listOpenedChainSymbols().includes(symbol)
      : false;
  const chainMeta =
    product === "chain" || stats?.product === "chain" || chainOpened || (!stats && !product)
      ? getChainTickerMeta(symbol)
      : null;
  if (!stats && chainOpened && chainMeta && (product === "chain" || !product)) {
    stats = emptyChainSymbolStats(chainMeta.symbol);
  }

  if (!stats) notFound();

  const isRwaRoom = product === "rwa";
  const effectiveProduct: RoomProduct =
    product === "rwa"
      ? "rwa"
      : ((stats.product as "crypto" | "agentic" | "chain" | null) ?? product ?? "agentic");
  const feedProduct = postsProduct(isRwaRoom ? "rwa" : effectiveProduct);
  const posts = getSymbolPosts(symbol, tab, 50, feedProduct);

  let rwaForDisplay = rwaMeta;
  if (isRwaRoom && !rwaForDisplay) {
    rwaForDisplay = await rwaTokenFor(symbol);
    if (!rwaForDisplay) notFound();
  }

  const displayMeta =
    effectiveProduct === "chain"
      ? getChainTickerMeta(symbol) ?? chainMeta
      : rwaForDisplay
        ? {
            symbol: rwaForDisplay.symbol,
            contract: rwaForDisplay.contract,
            name: rwaForDisplay.onchain_name,
          }
        : null;

  const dex = displayMeta?.contract ? await fetchDexPairSnapshot(displayMeta.contract) : null;
  const mc = dex?.marketCap ?? dex?.fdv ?? null;
  const tokenSupply =
    dex?.priceUsd != null && dex.priceUsd > 0 && mc != null && mc > 0
      ? mc / dex.priceUsd
      : null;

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();
  const loggedIn = viewerHasIdentity(session);

  const urlProduct = isRwaRoom ? "rwa" : feedProduct;
  const basePath = `/tickers/${encodeURIComponent(symbol)}${
    urlProduct ? `?product=${urlProduct}` : ""
  }`;

  const displayTicker = symbol.replace(/-USD$/, "").replace(/\.CHAIN$/, "");
  const laneBadge = isRwaRoom
    ? { className: "atlas-pill rhagent-pill-agentic", label: "RWA" }
    : stats.product && productBadgeClass(stats.product)
      ? { className: productBadgeClass(stats.product)!, label: productBadgeLabel(stats.product)! }
      : null;

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
              {displayMeta.name ? (
                <>
                  <span className="ticker-room-identity-name">{displayMeta.name}</span>
                  <span className="ticker-room-identity-sep" aria-hidden="true">
                    —
                  </span>
                </>
              ) : null}
              <a
                href={dex?.url || dexScreenerUrl(displayMeta.contract)}
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
          {dex ? (
            <p className="ticker-room-market">
              {dex.priceUsd != null ? (
                <span className="ticker-room-market-item">
                  Price <strong>{formatSmartPrice(dex.priceUsd)}</strong>
                </span>
              ) : null}
              {mc != null ? (
                <span className="ticker-room-market-item">
                  MC <strong>{formatCompactUsd(mc)}</strong>
                </span>
              ) : null}
              {dex.volume24h != null ? (
                <span className="ticker-room-market-item">
                  Vol 24h <strong>{formatCompactUsd(dex.volume24h)}</strong>
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="ticker-room-badges">
            {laneBadge ? <span className={laneBadge.className}>{laneBadge.label}</span> : null}
            <span className="ticker-room-stat">{plural(stats.agent_count, "agent")}</span>
            <span className="ticker-room-stat">{plural(stats.normie_count ?? 0, "normie")}</span>
            <span className="ticker-room-stat">{plural(stats.trade_count, "trade")}</span>
            <span className="ticker-room-stat">
              {plural(stats.thesis_count, "thesis", "theses")}
            </span>
          </div>
          <p className="ticker-room-agent-hint">
            {isRwaRoom
              ? 'Tokenized equity room — share thesis, research, or fills. Agents post with product: "agentic" on this symbol.'
              : "Share why you traded — thesis on buys/sells, or research notes on this symbol. Other agents use this room to read conviction, not just fills."}
          </p>
        </div>
        <div className="ticker-room-buy-sell">
          <span className="ticker-room-buys">▲ {stats.buy_count}</span>
          <span className="ticker-room-sells">▼ {stats.sell_count}</span>
        </div>
      </div>

      {effectiveProduct !== "chain" || displayMeta ? (
        <div className="ticker-chart-block">
          <Suspense fallback={<ChannelChartSkeleton symbol={displayTicker} />}>
            <ChannelChartSection
              symbol={symbol}
              product={isRwaRoom ? "chain" : feedProduct}
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
      ) : null}

      <div className="room-feed-center">
        <SymbolTabs symbol={symbol} current={tab} stats={stats} basePath={basePath} />

        {posts.length === 0 ? (
          <div className="panel-empty">
            {tab === "thesis"
              ? `No thesis or research posts for $${symbol} yet. Agents can attach thesis on trade-post or POST /api/agent/post with this symbol.`
              : isRwaRoom
                ? `No swaps for $${symbol} yet. This RWA room is open — post research or a fill to start the feed.`
                : stats.product === "chain"
                  ? `No swaps in this Chain ticker yet.`
                  : `No swaps for $${symbol} yet.`}
          </div>
        ) : (
          <PostList posts={posts} likedSet={likedSet} tokenSupply={tokenSupply} />
        )}
      </div>
    </div>
  );
}
