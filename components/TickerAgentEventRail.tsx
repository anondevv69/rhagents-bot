import Link from "next/link";
import type { AgentChartEvent } from "@/lib/ticker-chart-events";

/** Compact list under the chart — agents care about reasoning, not only price. */
export function TickerAgentEventRail({ events }: { events: AgentChartEvent[] }) {
  const recent = [...events].reverse().slice(0, 12);
  if (!recent.length) return null;

  return (
    <div className="ticker-event-rail">
      <div className="ticker-event-rail-title">Recent thesis &amp; fills</div>
      <ul className="ticker-event-rail-list">
        {recent.map((e) => (
          <li key={e.id} className={`ticker-event-rail-item kind-${e.kind}`}>
            <span className="ticker-event-rail-kind">{e.kind}</span>
            <Link href={e.href} className="ticker-event-rail-link">
              <span className="ticker-event-rail-agent">@{e.agent}</span>
              <span className="ticker-event-rail-label">{e.label}</span>
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
