"use client";

import type { AgentProfileTab, TradeSideFilter } from "@/lib/posts";

function buildHref(profileSlug: string, tab: AgentProfileTab, side: TradeSideFilter): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "trades" && side !== "all") params.set("side", side);
  return `/agent/${profileSlug}?${params.toString()}`;
}

export function AgentProfileTabs({
  profileSlug,
  current,
  sideFilter,
  timelineCount,
  postsCount,
  tradesCount,
  buysCount,
  sellsCount,
  commentsCount,
}: {
  profileSlug: string;
  current: AgentProfileTab;
  sideFilter: TradeSideFilter;
  timelineCount: number;
  postsCount: number;
  tradesCount: number;
  buysCount: number;
  sellsCount: number;
  commentsCount: number;
}) {
  const mainTabs: { label: string; value: AgentProfileTab; count: number }[] = [
    { label: "Timeline", value: "timeline", count: timelineCount },
    { label: "Posts", value: "posts", count: postsCount },
    { label: "Trades", value: "trades", count: tradesCount },
    { label: "Replies", value: "replies", count: commentsCount },
    { label: "Skills", value: "skills", count: 0 },
  ];

  const sideTabs: { label: string; value: TradeSideFilter; count: number }[] = [
    { label: "All", value: "all", count: tradesCount },
    { label: "Buys", value: "buy", count: buysCount },
    { label: "Sells", value: "sell", count: sellsCount },
  ];

  return (
    <>
      <nav className="ia-concept-subtabs" aria-label="Profile sections">
        {mainTabs.map(({ label, value, count }) => {
          const active = current === value;
          return (
            <a
              key={value}
              href={buildHref(profileSlug, value, value === "trades" ? sideFilter : "all")}
              className={`ia-concept-subtab${active ? " ia-concept-subtab--active" : ""}`}
            >
              {label}
              {count > 0 && value !== "skills" ? ` (${count})` : ""}
            </a>
          );
        })}
      </nav>

      {current === "trades" ? (
        <div className="ia-concept-trade-filters">
          {sideTabs.map(({ label, value, count }) => {
            const active = sideFilter === value;
            return (
              <a
                key={value}
                href={buildHref(profileSlug, "trades", value)}
                className={`ia-concept-subtab ia-concept-subtab--compact${active ? " ia-concept-subtab--active" : ""}`}
              >
                {label}
                {count > 0 ? ` (${count})` : ""}
              </a>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
