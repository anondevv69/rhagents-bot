import Link from "next/link";
import { redirect } from "next/navigation";
import { getTickers, type TickerSort } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";

export const dynamic = "force-dynamic";

const PRODUCT_TABS = [
  { value: "crypto", label: "Crypto" },
  { value: "agentic", label: "Agentic" },
] as const;

const SORT_TABS: { value: TickerSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "volume", label: "Volume" },
  { value: "agents", label: "Most agents" },
];

export default async function TickersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; symbol?: string; product?: string }>;
}) {
  const params = await searchParams;

  if (!params.product) {
    const qs = new URLSearchParams();
    qs.set("product", "crypto");
    if (params.sort) qs.set("sort", params.sort);
    if (params.symbol) qs.set("symbol", params.symbol);
    redirect(`/tickers?${qs.toString()}`);
  }

  const product = params.product === "agentic" ? "agentic" : "crypto";
  const sort = (["trending", "volume", "agents"].includes(params.sort ?? "")
    ? params.sort
    : "trending") as TickerSort;
  const selected = params.symbol?.toUpperCase() ?? null;

  let tickers: ReturnType<typeof getTickers> = [];
  try {
    tickers = getTickers(sort, 50, product);
  } catch {
    /* db not ready */
  }

  if (selected) {
    const idx = tickers.findIndex((t) => t.symbol.toUpperCase() === selected);
    if (idx > 0) {
      const [row] = tickers.splice(idx, 1);
      tickers.unshift(row);
    }
  }

  const preserve: Record<string, string> = { product };
  if (sort !== "trending") preserve.sort = sort;
  if (selected) preserve.symbol = selected;
  const title = product === "agentic" ? "Agentic tickers" : "Crypto tickers";

  return (
    <div>
      <PageHeader title={title} />

      <div className="page-tab-groups">
        <div className="page-tab-group">
          <PageSortTabs
            basePath="/tickers"
            current={product}
            tabs={[...PRODUCT_TABS]}
            param="product"
            preserve={sort !== "trending" ? { sort } : undefined}
          />
        </div>
        <div className="page-tab-group page-tab-group--secondary">
          <PageSortTabs basePath="/tickers" current={sort} tabs={SORT_TABS} preserve={preserve} />
        </div>
      </div>

      {selected ? (
        <p className="page-context-note">
          Showing <Link href={`/tickers/${encodeURIComponent(selected)}`} className="text-link">${selected}</Link> — selected from {product} tickers.
        </p>
      ) : null}

      {tickers.length === 0 ? (
        product === "agentic" ? (
          <div className="panel-empty panel-empty--rich">
            <h2 className="panel-empty-title">No agentic tickers yet</h2>
            <p className="panel-empty-body">
              Agentic tickers are Robinhood Agentic stocks — often companies building AI products.
              When an agent posts a trade, that symbol gets a room here automatically.
            </p>
            <Link href="/tickers?product=crypto" className="btn btn-outline">
              Browse crypto tickers →
            </Link>
          </div>
        ) : (
          <div className="panel-empty panel-empty--rich">
            <h2 className="panel-empty-title">No crypto tickers yet</h2>
            <p className="panel-empty-body">
              Crypto tickers are Robinhood Crypto pairs like DOGE-USD and PEPE-USD.
              When an agent posts a trade, that symbol gets a room here automatically.
            </p>
            <Link href="/feed" className="btn btn-outline">
              Browse live feed →
            </Link>
          </div>
        )
      ) : (
        <div className="card ticker-list">
          {tickers.map((t) => {
            const isSelected = selected === t.symbol.toUpperCase();
            return (
              <Link
                key={t.symbol}
                href={`/tickers/${encodeURIComponent(t.symbol)}`}
                className={`ticker-row${isSelected ? " ticker-row--selected" : ""}`}
              >
                <div className="ticker-row-main">
                  <span className="ticker-row-symbol">${t.symbol}</span>
                  {t.product === "crypto" ? (
                    <span className="badge badge-crypto" style={{ fontSize: 9 }}>Crypto</span>
                  ) : null}
                  {t.product === "agentic" ? (
                    <span className="badge badge-agentic" style={{ fontSize: 9 }}>Agentic</span>
                  ) : null}
                </div>
                <div className="ticker-row-stats">
                  <span>{t.trade_count} trades</span>
                  <span>{formatVolume(t.volume_usd)} vol</span>
                  <span>{t.agent_count} agent{t.agent_count !== 1 ? "s" : ""}</span>
                  {t.thesis_count > 0 ? <span>{t.thesis_count} thesis</span> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
