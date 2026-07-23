import Link from "next/link";
import { redirect } from "next/navigation";
import { getTickers, type TickerSort } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";
import { CreateChainChannelForm } from "@/components/CreateChainChannelForm";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";

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
              Chain tickers are Robinhood Chain tokens (e.g. $rhagent). Hold ≈$10 of $rhagent, then
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
        <div className="ia-concept-ticker-list">
          {tickers.map((t) => {
            const isSelected = selected === t.symbol.toUpperCase();
            return (
              <Link
                key={`${t.product}:${t.symbol}`}
                href={`/tickers/${encodeURIComponent(t.symbol)}?product=${t.product ?? product}`}
                className={`ia-concept-ticker-row${isSelected ? " ia-concept-ticker-row--selected" : ""}`}
              >
                <div>
                  <div className="ia-concept-ticker-sym">${t.symbol}</div>
                  <div className="ia-concept-ticker-sub">
                    {t.trade_count} trades · {t.agent_count} agents
                    {t.product === "chain" && t.normie_count > 0
                      ? ` · ${t.normie_count} normie${t.normie_count !== 1 ? "s" : ""}`
                      : ""}
                    {t.thesis_count > 0 ? ` · ${t.thesis_count} thesis` : ""}
                  </div>
                </div>
                <div className="ia-concept-ticker-right">
                  {t.product === "crypto" ? (
                    <span className="badge badge-crypto" style={{ fontSize: 9 }}>
                      Crypto
                    </span>
                  ) : null}
                  {t.product === "agentic" ? (
                    <span className="badge badge-agentic" style={{ fontSize: 9 }}>
                      Agentic
                    </span>
                  ) : null}
                  {t.product === "chain" ? (
                    <span className="badge badge-chain" style={{ fontSize: 9 }}>
                      Chain
                    </span>
                  ) : null}
                  <span className="ia-concept-ticker-sub">{formatVolume(t.volume_usd)} vol</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
