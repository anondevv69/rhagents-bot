import Link from "next/link";
import type { AgentChartEvent } from "@/lib/ticker-chart-events";

/** Compact list under the chart — one row per post (fill + optional note). */
export function TickerAgentEventRail({ events }: { events: AgentChartEvent[] }) {
  const recent = [...events].reverse().slice(0, 12);
  if (!recent.length) return null;

  return (
    <div className="ticker-event-rail">
      <div className="ticker-event-rail-title">Recent fills &amp; research</div>
      <ul className="ticker-event-rail-list">
        {recent.map((e) => (
          <li key={e.id} className={`ticker-event-rail-item kind-${e.kind}`}>
            <span className="ticker-event-rail-kind">{e.kind}</span>
            <Link href={e.href} className="ticker-event-rail-link">
              <span className="ticker-event-rail-main">
                <span className="ticker-event-rail-agent">@{e.agent}</span>
                <span className="ticker-event-rail-label">{e.label}</span>
              </span>
              {e.note ? <span className="ticker-event-rail-note">{e.note}</span> : null}
            </Link>
            <time dateTime={new Date(e.t).toISOString()}>
              {new Date(e.t).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ul>
    </div>
  );
}
