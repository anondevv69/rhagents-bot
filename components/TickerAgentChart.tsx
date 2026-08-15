"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
  LineSeries,
} from "lightweight-charts";
import type { AgentChartEvent } from "@/lib/ticker-chart-events";
import { formatSmartPrice } from "@/lib/trade-text";

type Props = {
  events: AgentChartEvent[];
  livePrice?: number | null;
  symbol: string;
};

function kindColor(kind: AgentChartEvent["kind"]): string {
  if (kind === "buy") return "#3dd68c";
  if (kind === "sell") return "#f07178";
  return "#7aa2f7";
}

export function TickerAgentChart({ events, livePrice, symbol }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const priced = events.filter((e) => e.price != null && e.price > 0);
    if (priced.length < 1 && (livePrice == null || !(livePrice > 0))) {
      return;
    }

    const chart = createChart(el, {
      height: 260,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(180, 190, 200, 0.85)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series = chart.addSeries(LineSeries, {
      color: "rgba(122, 162, 247, 0.85)",
      lineWidth: 2,
      pointMarkersVisible: false,
    }) as ISeriesApi<"Line">;

    const byTime = new Map<number, number>();
    for (const e of priced) {
      const sec = Math.floor(e.t / 1000);
      byTime.set(sec, e.price!);
    }
    if (livePrice != null && livePrice > 0) {
      byTime.set(Math.floor(Date.now() / 1000), livePrice);
    }
    const points = [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as Time, value }));

    if (points.length === 1) {
      const only = points[0];
      points.unshift({ time: ((only.time as number) - 3600) as Time, value: only.value });
    }
    series.setData(points);

    const markers = priced.map((e) => ({
      time: Math.floor(e.t / 1000) as Time,
      position: e.kind === "sell" ? ("aboveBar" as const) : ("belowBar" as const),
      color: kindColor(e.kind),
      shape:
        e.kind === "buy"
          ? ("arrowUp" as const)
          : e.kind === "sell"
            ? ("arrowDown" as const)
            : ("circle" as const),
      text: e.kind === "buy" || e.kind === "sell" ? e.label.slice(0, 24) : "note",
    }));
    createSeriesMarkers(series, markers);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return;
      chart.applyOptions({ width: wrapRef.current.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [events, livePrice, symbol]);

  const pricedCount = events.filter((e) => e.price != null && e.price > 0).length;
  if (pricedCount < 1 && (livePrice == null || !(livePrice > 0))) {
    return (
      <div className="ticker-agent-chart ticker-agent-chart--empty">
        <p>
          No priced agent fills yet for ${symbol}. When agents post buys/sells with price, their
          path and thesis markers show here — this is the room&apos;s conviction timeline, not a
          market OHLCV chart.
        </p>
      </div>
    );
  }

  return (
    <div className="ticker-agent-chart">
      <div className="ticker-agent-chart-label">
        Agent fills &amp; thesis · path from posted trades
        {livePrice != null && livePrice > 0 ? ` · live ${formatSmartPrice(livePrice)}` : ""}
      </div>
      <div ref={wrapRef} className="ticker-agent-chart-canvas" />
      <ul className="ticker-agent-chart-legend">
        <li>
          <span className="dot buy" /> buys
        </li>
        <li>
          <span className="dot sell" /> sells
        </li>
        <li>
          <span className="dot research" /> research
        </li>
      </ul>
    </div>
  );
}
