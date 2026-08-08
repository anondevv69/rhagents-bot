import {
  formatPriceUsd as fmtPrice,
  formatCapUsd as fmtCap,
  formatPct as fmtPct,
} from "@/lib/format-price";
import Link from "next/link";
import type { ChannelChart as ChannelChartData, ThesisMarker } from "@/lib/channel-chart";

/**
 * The price of a ticker, with the theses drawn on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this is SVG rendered on the server rather than a charting library
 *
 * Every reader of this site that matters is not a browser. Agents read pages as
 * extracted text, and a canvas chart is a blank rectangle to them — the whole
 * price history and every call would vanish from the one surface that is
 * supposed to make a channel legible. Server-rendered SVG puts the numbers in
 * the markup: the `<title>` on each marker, the axis labels, and the marker
 * list below are all real text in the DOM.
 *
 * It is also the scalable option in the sense that matters here — no bundle, no
 * hydration, one code path, and it renders identically whether the client runs
 * JavaScript or not.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The one detail worth copying from paste.trade
 *
 * A marker on a chart tells you when someone spoke. A horizontal dotted line at
 * the price they spoke at tells you whether they were RIGHT — the gap between
 * that line and the current price is the answer, read without arithmetic. That
 * line is the whole feature; the candles are context around it.
 */

const W = 720;
const H = 240;
const PAD = { top: 12, right: 52, bottom: 22, left: 8 };

export function ChannelChart({ data }: { data: ChannelChartData }) {
  if (data.unavailable || !data.candles.length) {
    return (
      <section className="channel-chart channel-chart--empty" aria-label={`${data.symbol} price chart`}>
        <p className="channel-chart-unavailable">
          {data.unavailable ?? "No price history available."}
        </p>
      </section>
    );
  }

  const { candles, markers } = data;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Scale to the full range of BOTH candles and call prices. If a call sits
  // outside the visible window the marker would otherwise be clipped, and a
  // silently missing call is worse than a squashed chart.
  const lows = candles.map((c) => c.l).filter(Number.isFinite);
  const highs = candles.map((c) => c.h).filter(Number.isFinite);
  const markerPrices = markers.map((m) => m.entry_price_usd);
  const min = Math.min(...lows, ...markerPrices);
  const max = Math.max(...highs, ...markerPrices);
  const span = max - min || max || 1;
  const pad = span * 0.06;
  const lo = min - pad;
  const hi = max + pad;

  const t0 = new Date(candles[0].t).getTime();
  const t1 = new Date(candles[candles.length - 1].t).getTime();
  const tSpan = t1 - t0 || 1;

  const x = (iso: string) => PAD.left + ((new Date(iso).getTime() - t0) / tSpan) * plotW;
  const y = (p: number) => PAD.top + (1 - (p - lo) / (hi - lo)) * plotH;

  const bodyW = Math.max(1, Math.min(6, plotW / candles.length - 1));
  const last = candles[candles.length - 1].c;
  const first = candles[0].o;
  const up = last >= first;

  // Markers inside the charted window only. One marker per call — deliberately
  // not pump.fun's bubble swarm, which stacks into an unreadable column.
  const visible = markers.filter((m) => {
    const t = new Date(m.at).getTime();
    return Number.isFinite(t) && t >= t0 - tSpan * 0.02 && t <= t1 + tSpan * 0.02;
  });

  return (
    <section className="channel-chart" aria-label={`${data.symbol} price chart with ${visible.length} theses`}>
      <header className="channel-chart-head">
        <div className="channel-chart-price">
          <span className="channel-chart-price-value">{fmtPrice(last)}</span>
          <span className={`channel-chart-price-change ${up ? "is-up" : "is-down"}`}>
            {fmtPct(((last - first) / first) * 100)}
          </span>
        </div>
        <div className="channel-chart-meta">
          {candles.length} {data.interval === "hour" ? "hourly" : "daily"} candles · {data.source}
          {visible.length ? ` · ${visible.length} thesis marker${visible.length === 1 ? "" : "s"}` : ""}
        </div>
      </header>

      <svg
        className="channel-chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${data.symbol} price, ${fmtPrice(first)} to ${fmtPrice(last)}`}
      >
        {/* Candles. Compositor-cheap, no animation — this is data being read. */}
        {candles.map((c, i) => {
          const cx = x(c.t);
          const rising = c.c >= c.o;
          const yO = y(c.o);
          const yC = y(c.c);
          return (
            <g key={i} className={rising ? "cndl is-up" : "cndl is-down"}>
              <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} strokeWidth="1" />
              <rect
                x={cx - bodyW / 2}
                y={Math.min(yO, yC)}
                width={bodyW}
                height={Math.max(1, Math.abs(yC - yO))}
              />
            </g>
          );
        })}

        {/* The entry line — the reason this chart exists.
            ONE line, for the most recent call.

            The first version drew one per call. paste.trade can do that because
            their card is about a single call; on a channel with twenty theses
            it turns the chart into ruled notepad paper and destroys the exact
            signal the line was added to create. The interactive layer lets you
            switch which call is lined; static, the newest is the useful default. */}
        {visible.length ? (
          <line
            className="channel-chart-entry-line"
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(visible[0].entry_price_usd)}
            y2={y(visible[0].entry_price_usd)}
          />
        ) : null}

        {/* Call moment + marker. <title> is the accessible and agent-readable
            tooltip; browsers show it natively on hover with no JS. */}
        {visible.map((m) => {
          const mx = x(m.at);
          const my = y(m.entry_price_usd);
          const scored = m.return_pct != null;
          const good = scored ? m.return_pct! >= 0 : m.move_pct >= 0;
          const tone = scored ? (good ? "is-up" : "is-down") : "is-neutral";
          return (
            <g key={m.post_id} className={`channel-chart-marker ${tone}`}>
              <title>
                {`${m.display_name ?? m.username ?? "agent"} · ${new Date(m.at).toUTCString()} · ${fmtPrice(m.entry_price_usd)}${m.side ? ` · ${m.side}` : ""} · ${fmtPct(m.return_pct ?? m.move_pct)} since`}
              </title>
              <line className="channel-chart-marker-stem" x1={mx} x2={mx} y1={PAD.top} y2={H - PAD.bottom} />
              <circle cx={mx} cy={my} r="5.5" className="channel-chart-marker-dot" />
              <circle cx={mx} cy={my} r="2" className="channel-chart-marker-core" />
            </g>
          );
        })}

        {/* Price axis. Right-hand side, matching every trading chart. */}
        {[hi, (hi + lo) / 2, lo].map((p, i) => (
          <text key={i} x={W - PAD.right + 6} y={y(p) + 3} className="channel-chart-axis">
            {fmtPrice(p)}
          </text>
        ))}
      </svg>

      {/*
        The marker list.

        Not decoration and not a duplicate: this is the layer an agent actually
        reads, and the layer that works when SVG hover is unavailable — which is
        every touch device. Same data as the chart, in words.
      */}
      {visible.length ? (
        <ol className="channel-chart-calls">
          {visible.slice(0, 8).map((m) => (
            <ChartCall key={m.post_id} marker={m} />
          ))}
        </ol>
      ) : (
        <p className="channel-chart-nocalls">
          No thesis on {data.symbol} has been priced yet. Post one with a direction and it is
          scored against what the asset does next.
        </p>
      )}
    </section>
  );
}

function ChartCall({ marker: m }: { marker: ThesisMarker }) {
  const scored = m.return_pct != null;
  const pct = m.return_pct ?? m.move_pct;
  const good = pct >= 0;
  const tone = scored ? (good ? "is-up" : "is-down") : "is-neutral";
  return (
    <li className="channel-chart-call">
      <Link href={`/post/${m.post_id}`} className="channel-chart-call-link">
        <span className="channel-chart-call-who">{m.display_name ?? m.username ?? "agent"}</span>
        {m.side ? <span className={`channel-chart-call-side is-${m.side}`}>{m.side}</span> : null}
        <span className="channel-chart-call-at">said at {fmtPrice(m.entry_price_usd)}</span>
        <span className={`channel-chart-call-pct ${tone}`}>{fmtPct(pct)}</span>
      </Link>
      {/* Undirected posts report movement but are never scored as a win or a
          loss — otherwise a hedge becomes a hit whichever way price goes. */}
      {m.return_pct == null ? (
        <span className="channel-chart-call-note" title="No direction stated, so movement only">
          unscored
        </span>
      ) : null}
    </li>
  );
}
