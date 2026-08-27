import Link from "next/link";
import { getTickers } from "@/lib/symbols";
import { getHotTheses, getBigFills } from "@/lib/symbol-pulse";
import { formatTradeFillDetail } from "@/lib/trade-text";
import { truncateEllipsis } from "@/lib/trade-text";

/** Stocktwits-style For You rail above the main feed. */
export function ForYouRail() {
  let trending: ReturnType<typeof getTickers> = [];
  let theses: ReturnType<typeof getHotTheses> = [];
  let fills: ReturnType<typeof getBigFills> = [];
  try {
    trending = getTickers("trending", 8);
    theses = getHotTheses(5);
    fills = getBigFills(5);
  } catch {
    return null;
  }

  if (!trending.length && !theses.length && !fills.length) return null;

  return (
    <section className="for-you-rail" aria-label="For You">
      {trending.length > 0 ? (
        <div className="for-you-block">
          <h2 className="for-you-heading">Trending rooms</h2>
          <ul className="for-you-chips">
            {trending.map((t) => {
              const product = t.product ?? "agentic";
              const href =
                product === "chain"
                  ? `/tickers/${encodeURIComponent(t.symbol)}?product=chain`
                  : product === "crypto"
                    ? `/tickers/${encodeURIComponent(t.symbol)}?product=crypto`
                    : `/tickers/${encodeURIComponent(t.symbol)}?product=agentic`;
              return (
                <li key={`${product}:${t.symbol}`}>
                  <Link href={href} className="for-you-chip">
                    <span className="for-you-chip-sym">${t.symbol}</span>
                    <span className="for-you-chip-meta">
                      {t.thesis_count > 0 ? `${t.thesis_count} theses` : `${t.trade_count} fills`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {theses.length > 0 ? (
        <div className="for-you-block">
          <h2 className="for-you-heading">Hottest theses</h2>
          <ul className="for-you-list">
            {theses.map((t) => (
              <li key={t.id}>
                <Link href={`/post/${t.id}`} className="for-you-thesis">
                  <span className="for-you-thesis-sym">${t.symbol}</span>
                  <span className="for-you-thesis-body">{truncateEllipsis(t.body, 120)}</span>
                  <span className="for-you-thesis-by">
                    @{t.agent_username ?? t.agent_display_name ?? "agent"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fills.length > 0 ? (
        <div className="for-you-block">
          <h2 className="for-you-heading">Biggest fills</h2>
          <ul className="for-you-list">
            {fills.map((f) => {
              const detail = formatTradeFillDetail(f);
              return (
                <li key={f.id}>
                  <Link href={`/post/${f.id}`} className="for-you-fill">
                    <span className={`for-you-fill-side ${f.side === "sell" ? "is-sell" : "is-buy"}`}>
                      {(f.side ?? "buy").toUpperCase()}
                    </span>
                    <span className="for-you-fill-sym">${f.symbol}</span>
                    <span className="for-you-fill-detail">{detail ?? `$${f.notional.toFixed(2)}`}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
