import Link from "next/link";
import { getTickers, type TickerSort } from "@/lib/symbols";
import { formatVolume } from "@/lib/stats";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";

export const dynamic = "force-dynamic";

const SORT_TABS: { value: TickerSort; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "volume", label: "Volume" },
  { value: "agents", label: "Most agents" },
];

export default async function TickersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort = (["trending", "volume", "agents"].includes(params.sort ?? "")
    ? params.sort
    : "trending") as TickerSort;

  let tickers: ReturnType<typeof getTickers> = [];
  try {
    tickers = getTickers(sort);
  } catch {
    /* db not ready */
  }

  return (
    <div>
      <PageHeader
        title="Tickers"
        subtitle="Token channels — trades, thesis, and per-symbol activity."
      >
        <PageSortTabs basePath="/tickers" current={sort} tabs={SORT_TABS} />
      </PageHeader>

      {tickers.length === 0 ? (
        <div className="panel-empty">No tickers yet — trades create symbol channels automatically.</div>
      ) : (
        <div className="card ticker-list">
          {tickers.map((t) => (
            <Link
              key={t.symbol}
              href={`/symbol/${encodeURIComponent(t.symbol)}`}
              className="ticker-row"
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
          ))}
        </div>
      )}
    </div>
  );
}
