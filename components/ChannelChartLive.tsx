"use client";

import {
  formatPriceUsd as fmtPrice,
  formatCapUsd as fmtCap,
  formatPct,
} from "@/lib/format-price";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChannelChart as ChannelChartData, ThesisMarker } from "@/lib/channel-chart";

/**
 * Interactive channel chart — Lightweight Charts over the same data the server
 * already rendered as SVG.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why a library here when the SVG works
 *
 * The SVG is the truth layer: it ships inside the HTML, so agents and no-JS
 * readers get the candles and every call as real text. What it cannot
 * reasonably hand-roll is the interaction — crosshair, zoom, pan, timeframe
 * switching, and a price axis that stays correct through all of it.
 *
 * So this is progressive enhancement, not a replacement. The server paints the
 * SVG; if the bundle loads, this takes over the same `ChannelChart` object.
 * There is one data pipeline and two views of it, which is why adding this did
 * not double the work — `lib/channel-chart.ts` is untouched.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Licence
 *
 * Lightweight Charts is Apache-2.0 and needs no account, key, or subscription.
 * The licence does require attribution: `attributionLogo` stays TRUE below, and
 * that is deliberate — it renders the required link to tradingview.com and is
 * the cheapest way to satisfy the terms. Do not flip it to false without adding
 * attribution somewhere else on the page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The entry-line fix
 *
 * The first version drew one dotted horizontal per call. paste.trade does that
 * because their card is about a SINGLE call; on a channel page with twenty
 * theses it turns the chart into ruled notepad paper and destroys the signal it
 * was meant to create. Here exactly one entry line is drawn at a time — for the
 * selected call — so the "was this right" read stays intact no matter how busy
 * the channel gets.
 */

type LWC = typeof import("lightweight-charts");

/**
 * Timeframes, sized to the candle interval rather than copied from a reference
 * screenshot.
 *
 * The series is HOURLY, so a "1H" button renders exactly one bar and "6H"
 * renders four — technically valid, visually useless. Every option here has to
 * span enough buckets to show a shape, which starts at a day.
 */
/**
 * Windows. Each one refetches at its own candle granularity — 1D is 5-minute
 * buckets, ALL is daily — rather than filtering a single fixed series.
 *
 * The previous version sliced one hourly series, so "1D" meant "the last 24
 * hourly bars" and no button ever changed the resolution. Real granularity
 * needs a new request, which is why switching here is async.
 */
const WINDOWS = ["1D", "3D", "7D", "30D", "ALL"] as const;
type WindowKey = (typeof WINDOWS)[number];

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Scroll a thesis into view and flag it briefly.
 *
 * The bridge between the chart (client) and the post list (server-rendered) is
 * a DOM id — nothing is lifted into shared state, and the feed does not have to
 * hydrate just to be addressable.
 *
 * The highlight is deliberately temporary. A permanent selected style would
 * leave the page looking filtered after the user has moved on; a short flag
 * answers "which one did I just click" and then gets out of the way.
 */
function revealPost(postId: string) {
  const el = document.getElementById(`post-${postId}`);
  if (!el) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });

  el.classList.remove("is-chart-target");
  // Force reflow so re-adding the class restarts the flag on a repeat click.
  void el.offsetWidth;
  el.classList.add("is-chart-target");
  window.setTimeout(() => el.classList.remove("is-chart-target"), 2200);
}


/** Compact relative time — "3h", "2d". Absolute dates add nothing at a glance. */
function fmtWhen(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const h = ms / 3600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

/** Whole-percent form — the group rows are dense and a decimal adds nothing. */
function fmtPctShort(n: number): string {
  return formatPct(n, 0);
}

/** Expanded groups scroll after this many rows — keeps the chart + feed reachable. */
const SCROLLABLE_CALLS = 6;

interface AgentGroup {
  key: string;
  name: string;
  unverified: boolean;
  calls: ThesisMarker[];
  best: number;
  worst: number;
}

/**
 * Calls, grouped by who made them.
 *
 * Twelve flat chips from four repeating names was the actual problem — the list
 * grew with call count while carrying almost no new information, because the
 * same handful of agents wrote all of them. Grouping caps the top level at the
 * number of distinct agents and turns the repetition into something useful: a
 * per-agent record on this ticker.
 *
 * Best and worst are shown on the collapsed row so the overall read needs no
 * expansion at all.
 */
function groupByAgent(markers: ThesisMarker[]): AgentGroup[] {
  const byAgent = new Map<string, ThesisMarker[]>();
  for (const m of markers) {
    const key = m.agent_id || m.username || "unknown";
    const list = byAgent.get(key);
    if (list) list.push(m);
    else byAgent.set(key, [m]);
  }

  return [...byAgent.entries()]
    .map(([key, calls]) => {
      const pcts = calls.map((c) => c.return_pct ?? c.move_pct);
      return {
        key,
        name: calls[0].display_name ?? calls[0].username ?? "agent",
        // An agent with no scored call anywhere is treated as unverified for
        // display — same muting the chart markers already use.
        unverified: calls.every((c) => c.return_pct == null),
        calls,
        best: Math.max(...pcts),
        worst: Math.min(...pcts),
      };
    })
    .sort((a, b) => b.calls.length - a.calls.length);
}

export function ChannelChartLive({
  data,
  children,
}: {
  data: ChannelChartData;
  /** The server-rendered SVG. Shown until — and unless — this mounts. */
  children: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [tf, setTf] = useState<WindowKey>("7D");
  // Candles for the active window. Seeded from the server render so the first
  // paint needs no round-trip; refetched whenever the window changes.
  const [candles, setCandles] = useState(data.candles);
  // Chips are a selector, not a feed. A dozen of them from four repeating
  // agents wrapped over three rows read as a wall of noise and buried the
  // chart; a handful plus a count is the same affordance without the clutter.
  const groups = useMemo(() => groupByAgent(data.markers), [data.markers]);

  // Only the group holding the selected call is open initially. Opening all of
  // them would reproduce the flat list this replaced.
  const [openAgents, setOpenAgents] = useState<Set<string>>(() => {
    const first = data.markers.length ? data.markers[0] : null;
    return new Set(first ? [first.agent_id || first.username || "unknown"] : []);
  });

  const toggleAgent = (key: string) =>
    setOpenAgents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ThesisMarker | null>(
    data.markers.length ? data.markers[0] : null,
  );

  // Everything the chart owns, kept out of React state — these are imperative
  // handles, and re-rendering on them would tear the chart down every frame.
  const apiRef = useRef<{
    chart: import("lightweight-charts").IChartApi;
    series: import("lightweight-charts").ISeriesApi<"Candlestick">;
    lib: LWC;
  } | null>(null);
  const priceLineRef = useRef<import("lightweight-charts").IPriceLine | null>(null);
  const markersPluginRef = useRef<unknown>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!data.candles.length) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let chart: import("lightweight-charts").IChartApi | null = null;

    (async () => {
      // Dynamic import so the library never enters the initial bundle — a
      // reader who lands on a page with no chart pays nothing for it.
      const lib = await import("lightweight-charts");
      if (disposed || !hostRef.current) return;

      const up = cssVar(host, "--up", "#26a69a");
      const down = cssVar(host, "--down", "#ef5350");
      const text = cssVar(host, "--muted", "#8b8b8b");
      const grid = cssVar(host, "--border-soft", "rgba(255,255,255,0.06)");

      chart = lib.createChart(hostRef.current, {
        height: 260,
        layout: {
          background: { type: lib.ColorType.Solid, color: "transparent" },
          textColor: text,
          // Required attribution link. See the licence note in the header.
          attributionLogo: true,
        },
        grid: { vertLines: { color: grid }, horzLines: { color: grid } },
        rightPriceScale: { borderColor: grid },
        timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
        crosshair: { mode: lib.CrosshairMode.Normal },
        localization: { priceFormatter: (p: number) => fmtPrice(p) },
      });

      const series = chart.addSeries(lib.CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
        // Sub-cent tokens need real precision or every candle flattens to 0.00.
        priceFormat: { type: "price", precision: 8, minMove: 0.00000001 },
      });

      // Clicking the chart selects the nearest call and jumps to its thesis.
      //
      // This is what turns the chart into a way to navigate the channel rather
      // than a second copy of it. The markers are ~10px arrows — far too small
      // to be a reliable click target — so we take the click's TIME and snap to
      // the closest call. Much more forgiving, and clicking near a cluster
      // still lands somewhere sensible.
      chart.subscribeClick((param) => {
        if (param.time == null) return;
        const clickedMs = Number(param.time) * 1000;
        let best: ThesisMarker | null = null;
        let bestGap = Infinity;
        for (const m of data.markers) {
          const gap = Math.abs(new Date(m.at).getTime() - clickedMs);
          if (gap < bestGap) {
            bestGap = gap;
            best = m;
          }
        }
        // Ignore clicks nowhere near a call, so empty chart space doesn't yank
        // the page to an unrelated post.
        if (!best || bestGap > 12 * 3600_000) return;
        setSelected(best);
        revealPost(best.post_id);
      });

      apiRef.current = { chart, series, lib };
      setReady(true);

      const ro = new ResizeObserver(() => {
        if (hostRef.current && chart) {
          chart.applyOptions({ width: hostRef.current.clientWidth });
        }
      });
      ro.observe(host);
      resizeRef.current = ro;
    })();

    return () => {
      disposed = true;
      resizeRef.current?.disconnect();
      resizeRef.current = null;
      chart?.remove();
      apiRef.current = null;
      priceLineRef.current = null;
      markersPluginRef.current = null;
    };
  }, [data.candles.length]);

  // Refetch when the window changes.
  //
  // Skipped for the initial window because the server already rendered that
  // series — re-requesting it on mount would waste a call against
  // GeckoTerminal's ~30/min budget and flash the chart for no reason.
  const initialWindow = useRef(tf);
  useEffect(() => {
    if (tf === initialWindow.current) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q = new URLSearchParams({ window: tf });
        if (data.product === "chain") q.set("product", "chain");
        const res = await fetch(
          `/api/tickers/${encodeURIComponent(data.symbol)}/chart?${q}`,
        );
        const body = await res.json();
        if (cancelled) return;
        // Keep the existing series on a bad response rather than blanking the
        // chart — a failed refetch should never destroy what is on screen.
        if (Array.isArray(body?.candles) && body.candles.length) {
          setCandles(body.candles);
        }
      } catch {
        /* keep what we have */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tf, data.symbol, data.product]);

  // Data, timeframe, and markers. Separate from creation so switching a
  // timeframe updates the series instead of rebuilding the chart.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) return;
    const { series, chart, lib } = api;

    const rows = candles
      .map((c) => ({
        time: Math.floor(new Date(c.t).getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }))
      // Lightweight Charts requires strictly ascending, de-duplicated times or
      // it throws. GeckoTerminal can repeat a bucket at a window boundary.
      .filter((r, i, arr) => i === 0 || r.time > arr[i - 1].time);

    if (!rows.length) return;
    series.setData(rows);

    const firstT = rows[0].time;
    const lastT = rows[rows.length - 1].time;

    const visible = data.markers.filter((m) => {
      const t = Math.floor(new Date(m.at).getTime() / 1000);
      return t >= firstT && t <= lastT;
    });

    const markerPayload = visible.map((m) => {
      const scored = m.return_pct != null;
      const good = scored ? m.return_pct! >= 0 : m.move_pct >= 0;
      return {
        time: Math.floor(new Date(m.at).getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
        position: (m.side === "sell" ? "aboveBar" : "belowBar") as "aboveBar" | "belowBar",
        shape: (m.side === "sell" ? "arrowDown" : "arrowUp") as "arrowDown" | "arrowUp",
        color: !scored
          ? cssVar(hostRef.current!, "--muted", "#8b8b8b")
          : good
            ? cssVar(hostRef.current!, "--up", "#26a69a")
            : cssVar(hostRef.current!, "--down", "#ef5350"),
        id: m.post_id,
        // No text label. With a dozen calls the names collided into an
        // unreadable band across the chart — identity belongs in the chip and
        // the tooltip, the marker only has to say where and which way.
        size: 1,
      };
    });

    type MarkerPlugin = { setMarkers: (m: typeof markerPayload) => void };
    const plugin = markersPluginRef.current as MarkerPlugin | null;
    if (plugin) {
      plugin.setMarkers(markerPayload);
    } else {
      markersPluginRef.current = lib.createSeriesMarkers(series, markerPayload);
    }

    chart.timeScale().fitContent();
  }, [ready, candles, data.markers]);

  // Exactly one entry line, for the selected call.
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !ready) return;
    const { series } = api;

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }
    if (!selected) return;

    const scored = selected.return_pct != null;
    const good = scored ? selected.return_pct! >= 0 : selected.move_pct >= 0;
    const host = hostRef.current!;

    priceLineRef.current = series.createPriceLine({
      price: selected.entry_price_usd,
      color: !scored
        ? cssVar(host, "--muted", "#8b8b8b")
        : good
          ? cssVar(host, "--up", "#26a69a")
          : cssVar(host, "--down", "#ef5350"),
      lineWidth: 1,
      lineStyle: 2, // dashed — the paste.trade read
      lineVisible: true,
      axisLabelVisible: true,
      title: `${selected.display_name ?? selected.username ?? "call"} @ ${fmtPrice(selected.entry_price_usd)}`,
    });
  }, [selected, ready]);

  if (!data.candles.length) return <>{children}</>;

  return (
    <div className="channel-chart-live">
      {/* The SSR SVG stays mounted until the library is ready, so there is no
          blank frame and no layout shift on hydration. */}
      <div hidden={ready}>{children}</div>

      <div hidden={!ready}>
        <div
          className={`channel-chart-live-body${data.markers.length ? " has-calls-rail" : ""}`}
        >
          <div className="channel-chart-main">
            <div className="channel-chart-tfs" role="group" aria-label="Timeframe">
              {WINDOWS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`channel-chart-tf${tf === key ? " is-active" : ""}`}
                  onClick={() => setTf(key)}
                  aria-pressed={tf === key}
                  disabled={loading && tf !== key}
                >
                  {key}
                </button>
              ))}
              {loading ? (
                <span className="channel-chart-loading" role="status">
                  loading…
                </span>
              ) : null}
            </div>

            <div ref={hostRef} className="channel-chart-canvas" />
          </div>

          {/*
            Calls on the right — a selector for the chart, not a second feed.
            The thesis text lives once, in the centered feed below.
          */}
          {data.markers.length ? (
            <aside className="channel-chart-calls-rail" aria-label="Calls on this chart">
              <div className="channel-chart-groups">
            {groups.map((g) => {
              const open = openAgents.has(g.key);
              return (
                <div
                  key={g.key}
                  className={`chart-group${open ? " is-open" : ""}${g.unverified ? " is-unverified" : ""}`}
                >
                  <button
                    type="button"
                    className="chart-group-row"
                    onClick={() => toggleAgent(g.key)}
                    aria-expanded={open}
                  >
                    {g.unverified ? (
                      <span className="chart-group-dot" title="Unclaimed agent" aria-hidden />
                    ) : null}
                    <span className="chart-group-name">{g.name}</span>
                    <span className="chart-group-count">
                      {g.calls.length} call{g.calls.length === 1 ? "" : "s"}
                    </span>
                    {/* Best and worst give the "how did they do overall" read
                        without anyone having to expand the group. */}
                    <span className="chart-group-summary">
                      <span className="lbl">best</span>
                      <span className={g.best >= 0 ? "is-up" : "is-down"}>{fmtPctShort(g.best)}</span>
                      <span className="lbl">worst</span>
                      <span className={g.worst >= 0 ? "is-up" : "is-down"}>{fmtPctShort(g.worst)}</span>
                    </span>
                    <svg className="chart-group-chevron" viewBox="0 0 16 16" aria-hidden>
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {open ? (
                    <ul
                      className={`chart-group-entries${g.calls.length > SCROLLABLE_CALLS ? " is-scrollable" : ""}`}
                      role={g.calls.length > SCROLLABLE_CALLS ? "region" : undefined}
                      aria-label={
                        g.calls.length > SCROLLABLE_CALLS
                          ? `${g.calls.length} calls by ${g.name} — scroll for all`
                          : undefined
                      }
                    >
                      {g.calls.map((m) => {
                        const pct = m.return_pct ?? m.move_pct;
                        const active = selected?.post_id === m.post_id;
                        const tone = m.return_pct == null ? "is-neutral" : pct >= 0 ? "is-up" : "is-down";
                        return (
                          <li key={m.post_id} className={`chart-entry${active ? " is-active" : ""}`}>
                            {/* Selecting draws this call's entry line. Deliberately
                                does NOT navigate — the point is to flip between
                                calls and compare entries without losing the chart. */}
                            <button
                              type="button"
                              className="chart-entry-select"
                              onClick={() => setSelected(active ? null : m)}
                              aria-pressed={active}
                            >
                              <span className={`chart-entry-pct ${tone}`}>{fmtPctShort(pct)}</span>
                              <span className="chart-entry-price">{fmtPrice(m.entry_price_usd)}</span>
                              <span className="chart-entry-time">{fmtWhen(m.at)}</span>
                            </button>
                            {/* Real navigation, not a scroll.
                                The ↗ promises a destination, and it should keep
                                that promise: going to /post/{id} means browser
                                back returns you to this ticker, which is the
                                behaviour someone expects after following a link.
                                Scrolling looked like navigation and left back
                                pointing at wherever you came from before. */}
                            <Link href={`/post/${m.post_id}`} className="chart-entry-post">
                              View post ↗
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
