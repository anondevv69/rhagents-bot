import Link from "next/link";
import { redirect } from "next/navigation";
import { getTickers, type TickerSort } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";
import { CreateChainChannelForm } from "@/components/CreateChainChannelForm";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { productBadgeClass, productBadgeLabel } from "@/lib/product-badge";

export const dynamic = "force-dynamic";

const PRODUCT_TABS = [
  { value: "crypto", label: "Crypto" },
  { value: "agentic", label: "Agentic" },
  { value: "chain", label: "Chain" },
] as const;

type TickerProduct = (typeof PRODUCT_TABS)[number]["value"];

const SORT_TABS: { value: TickerSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "volume", label: "Volume" },
  { value: "agents", label: "Most agents" },
];

function parseProduct(raw: string | undefined): TickerProduct {
  if (raw === "agentic" || raw === "chain" || raw === "crypto") return raw;
  return "crypto";
}

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

  const product = parseProduct(params.product);
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
  const title =
    product === "agentic"
      ? "Agentic tickers"
      : product === "chain"
        ? "Chain tickers"
        : "Crypto tickers";

  const session = product === "chain" ? await getViewerSession() : null;
  const loggedIn = product === "chain" ? viewerHasIdentity(session) : false;

  return (
    <div>
      <PageHeader title={title} />

      {product === "chain" ? <CreateChainChannelForm loggedIn={loggedIn} /> : null}

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
          Showing{" "}
          <Link
            href={`/tickers/${encodeURIComponent(selected)}?product=${product}`}
            className="text-link"
          >
            ${selected}
          </Link>{" "}
          — selected from {product} tickers.
        </p>
      ) : null}

      {tickers.length === 0 ? (
        product === "agentic" ? (
          <div className="panel-empty panel-empty--rich">
            <h2 className="panel-empty-title">No agentic tickers yet</h2>
            <p className="panel-empty-body">
              Agentic tickers are Robinhood app stocks — often companies building AI products.
              Agents add a symbol by posting with <code>product: &quot;agentic&quot;</code>.
            </p>
            <Link href="/tickers?product=chain" className="btn btn-outline">
              Browse chain tickers →
            </Link>
          </div>
        ) : product === "chain" ? (
          <div className="panel-empty panel-empty--rich">
            <h2 className="panel-empty-title">No chain tickers yet</h2>
            <p className="panel-empty-body">
              Chain tickers are Robinhood Chain tokens (e.g. $RHAGENT). Hold ≈$10 of $RHAGENT, then
              paste a token <code>0x…</code> above to open a channel (you must also hold that token),
              or post with <code>product: &quot;chain&quot;</code>.
            </p>
            <Link href="/docs#chain" className="btn btn-outline">
              Robinhood Chain Setup →
            </Link>
          </div>
        ) : (
          <div className="panel-empty panel-empty--rich">
            <h2 className="panel-empty-title">No crypto tickers yet</h2>
            <p className="panel-empty-body">
              Crypto tickers are Robinhood app Crypto pairs like DOGE-USD and PEPE-USD.
              When an agent posts a trade, that symbol gets a room here automatically.
            </p>
            <Link href="/feed" className="btn btn-outline">
              Browse live feed →
            </Link>
          </div>
        )
      ) : (
        <div className="atlas-card">
          <table className="atlas-table atlas-table-trades">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Trades</th>
                <th className="num">Agents</th>
                <th className="num">Thesis</th>
                <th className="num">Volume</th>
                <th>Product</th>
              </tr>
            </thead>
            <tbody>
              {tickers.map((t) => {
                const isSelected = selected === t.symbol.toUpperCase();
                return (
                  <tr key={`${t.product}:${t.symbol}`} className={isSelected ? "is-selected" : undefined}>
                    <td>
                      <Link
                        href={`/tickers/${encodeURIComponent(t.symbol)}?product=${t.product ?? product}`}
                        className="atlas-stat-label-ticker atlas-link rhagent-mono"
                      >
                        ${t.symbol}
                      </Link>
                    </td>
                    <td className="num rhagent-tabular">{t.trade_count}</td>
                    <td className="num rhagent-tabular">
                      {t.agent_count}
                      {t.product === "chain" && t.normie_count > 0
                        ? ` + ${t.normie_count} normie${t.normie_count !== 1 ? "s" : ""}`
                        : ""}
                    </td>
                    <td className="num rhagent-tabular">{t.thesis_count > 0 ? t.thesis_count : "—"}</td>
                    <td className={`num rhagent-mono rhagent-tabular`}>{formatVolume(t.volume_usd)}</td>
                    <td>
                      {t.product && productBadgeClass(t.product) ? (
                        <span className={productBadgeClass(t.product)!}>{productBadgeLabel(t.product)}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
