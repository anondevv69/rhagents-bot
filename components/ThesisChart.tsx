import { getChannelChart, type ThesisMarker } from "@/lib/channel-chart";

/**
 * One call, on the price. The shareable artifact.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this is a different component from the channel chart
 *
 * A channel chart answers "how is this token doing". This answers "was this
 * person right", which is the only question the site actually exists to settle.
 * Same data pipeline, opposite framing: the channel chart shows many calls and
 * needs a window control; this shows exactly one and does not.
 *
 * That is the detail paste.trade gets right and it is easy to miss. Their chart
 * has no timeframe selector because the window is not a user preference — it is
 * a property of the call. The only interesting range is "from when they said it
 * to now", so the chart derives its own bounds and there is nothing to choose.
 * Their share URLs carry `?chart_from=<ms>` for the same reason: the window
 * travels with the call, not with the viewer.
 *
 * Rendered on the server as SVG so the whole thing — price, entry, return —
 * survives text extraction. An agent reading a thesis gets the verdict too.
 */

const W = 680;
const H = 220;
const PAD = { top: 14, right: 66, bottom: 18, left: 8 };

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/**
 * Price, readable at any magnitude.
 *
 * Sub-cent tokens were rendering as `8.81e-7`. That is accurate and nobody can
 * compare two of them at a glance. On-chain terminals all use the same
 * convention instead — compress the leading zeros into a subscript count and
 * keep the significant digits: `$0.0₆8813`. Same information, actually
 * legible, and it sorts visually the way a price should.
 */
function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.001) {
    // Count the zeros from the decimal expansion rather than via log10 —
    // floating point puts values like 1e-6 fractionally under their power of
    // ten, so the log route lands one short on exactly the prices this is for.
    const m = n.toFixed(20).match(/^0\.(0*)(\d+)/);
    if (!m) return `$${n.toExponential(2)}`;
    const zeros = m[1].length;
    // Round the significant digits rather than slicing the expansion — 0.00099
    // stringifies as 0.00098999… and slicing showed 9899 for a price of 9900.
    const sig = String(Math.round(n * Math.pow(10, zeros + 4))).slice(0, 4);
    const marker = String(zeros)
      .split("")
      .map((d) => SUBSCRIPTS[Number(d)])
      .join("");
    return `$0.0${marker}${sig}`;
  }
  if (n < 1) return `$${n.toPrecision(4)}`;
  if (n < 1000) return `$${n.toFixed(2)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Market cap, compact.
 *
 * The headline number for a chain-native token, because a unit price of
 * `$0.0₆8813` tells a reader nothing about whether the thing is early. `$88.0K`
 * answers the question they actually have. Every on-chain terminal leads with
 * this for the same reason.
 */
function fmtCap(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export async function ThesisChart({
  postId,
  symbol,
  product,
}: {
  postId: string;
  symbol: string;
  product?: string | null;
}) {
  const data = await getChannelChart(symbol, { product, interval: "hour", limit: 500 });
  const marker = data.markers.find((m) => m.post_id === postId) ?? null;

  // No captured price means no verdict to show. Say why rather than rendering
  // an empty frame — most often this is a thesis written before entry-price
  // capture existed, which the backfill fixes.
  if (!marker) {
    return (
      <section className="thesis-chart thesis-chart--empty">
        <p className="thesis-chart-note">
          {data.unavailable
            ? data.unavailable
            : `No price was captured for this call, so it isn't scored against $${symbol}.`}
        </p>
      </section>
    );
  }

  const calledMs = new Date(marker.at).getTime();
  // Window derived from the call: a little lead-in for context, then everything
  // since. Never a fixed lookback — a two-hour-old call and a two-month-old one
  // need completely different ranges to read correctly.
  const spanSinceMs = Math.max(Date.now() - calledMs, 3600_000);
  const fromMs = calledMs - spanSinceMs * 0.25;

  const candles = data.candles.filter((c) => new Date(c.t).getTime() >= fromMs);
  if (candles.length < 2) {
    return (
      <section className="thesis-chart thesis-chart--empty">
        <p className="thesis-chart-note">
          Not enough price history since this call to chart it yet.
        </p>
      </section>
    );
  }

  const scored = marker.return_pct != null;
  const pct = marker.return_pct ?? marker.move_pct;
  const good = pct >= 0;
  const last = candles[candles.length - 1].c;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Include the entry price in the scale or a call that has moved a long way
  // gets clipped off the top — the one thing that must always be visible.
  const lo0 = Math.min(...candles.map((c) => c.l), marker.entry_price_usd);
  const hi0 = Math.max(...candles.map((c) => c.h), marker.entry_price_usd);
  const pad = (hi0 - lo0 || hi0 || 1) * 0.08;
  const lo = lo0 - pad;
  const hi = hi0 + pad;

  const t0 = new Date(candles[0].t).getTime();
  const t1 = new Date(candles[candles.length - 1].t).getTime();
  const tSpan = t1 - t0 || 1;

  const x = (ms: number) => PAD.left + ((ms - t0) / tSpan) * plotW;
  const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * plotH;

  // Area under the close, shaded by outcome — the fastest possible read of
  // "did this go the right way" before any number is processed.
  const line = candles.map((c) => `${x(new Date(c.t).getTime())},${y(c.c)}`).join(" ");
  const area = `${PAD.left},${H - PAD.bottom} ${line} ${W - PAD.right},${H - PAD.bottom}`;

  const mx = x(calledMs);
  const my = y(marker.entry_price_usd);
  const tone = !scored ? "is-neutral" : good ? "is-up" : "is-down";

  // Both anchors use one supply figure, so the cap pair moves by exactly the
  // percentage shown. Deriving them independently would let rounding drift make
  // the headline disagree with the two numbers under it.
  const showCap = data.supply != null && data.supply > 0;
  const entryCap = showCap ? data.supply! * marker.entry_price_usd : null;
  const nowCap = showCap ? data.supply! * last : null;

  return (
    <section className={`thesis-chart ${tone}`} aria-label={`${symbol} since this call`}>
      <header className="thesis-chart-head">
        {/*
          Market cap leads where it means something.

          Supply is only present for chain-native tokens (see channel-chart.ts),
          so this automatically falls back to price for equities and tokenised
          equities — where the share price already is the intuitive number and
          the on-chain cap would describe the wrapper, not the company.

          Percentage change is identical either way: cap = price × supply, and
          the supply term cancels. The verdict is untouched by this switch.

          No side chip — the trade strip above already carries it.
        */}
        <div className="thesis-chart-said">
          <span className="thesis-chart-said-label">said at</span>
          {showCap ? (
            <>
              <strong className="thesis-chart-anchor">{fmtCap(entryCap!)}</strong>
              <span className="thesis-chart-anchor-sub">mcap</span>
              <span className="thesis-chart-anchor-alt">
                {fmtPrice(marker.entry_price_usd)} / token
              </span>
            </>
          ) : (
            <strong className="thesis-chart-anchor">{fmtPrice(marker.entry_price_usd)}</strong>
          )}
        </div>
        <div className="thesis-chart-verdict">
          <span className="thesis-chart-pct">{fmtPct(pct)}</span>
          {showCap ? (
            <span className="thesis-chart-now">
              now {fmtCap(nowCap!)} mcap
              <span className="thesis-chart-anchor-alt">{fmtPrice(last)} / token</span>
            </span>
          ) : (
            <span className="thesis-chart-now">now {fmtPrice(last)}</span>
          )}
        </div>
      </header>

      <svg
        className="thesis-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${symbol} moved ${fmtPct(pct)} since this call at ${fmtPrice(marker.entry_price_usd)}`}
      >
        <polygon className="thesis-chart-area" points={area} />
        <polyline
          className="thesis-chart-line"
          points={line}
          fill="none"
          vectorEffect="non-scaling-stroke"
        />

        {/* The entry line — the whole point. Everything above or below it is
            the verdict, read without arithmetic. */}
        <line
          className="thesis-chart-entry"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={my}
          y2={my}
        />
        <text className="thesis-chart-entry-label" x={W - PAD.right + 6} y={my + 3}>
          {fmtPrice(marker.entry_price_usd)}
        </text>

        {/* The moment of the call. */}
        <line className="thesis-chart-when" x1={mx} x2={mx} y1={PAD.top} y2={H - PAD.bottom} />
        <circle className="thesis-chart-dot" cx={mx} cy={my} r="5" />
        <circle className="thesis-chart-dot-core" cx={mx} cy={my} r="2" />
      </svg>

      <p className="thesis-chart-foot">
        {scored ? (
          <>
            {symbol} has moved {fmtPct(marker.move_pct)} since this call
            {marker.side === "sell" ? ", scored against a sell" : ""}.
          </>
        ) : (
          <>
            {symbol} has moved {fmtPct(marker.move_pct)} since this call. No direction was
            stated, so it is reported but not scored.
          </>
        )}{" "}
        Asset movement, not modelled profit — no entry, exit or size is assumed.
      </p>
    </section>
  );
}

export type { ThesisMarker };
