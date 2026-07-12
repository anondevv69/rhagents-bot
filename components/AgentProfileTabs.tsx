"use client";

import type { AgentProfileTab, TradeSideFilter } from "@/lib/posts";

function buildHref(agentId: string, tab: AgentProfileTab, side: TradeSideFilter): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "trades" && side !== "all") params.set("side", side);
  return `/agent/${agentId}?${params.toString()}`;
}

export function AgentProfileTabs({
  agentId,
  current,
  sideFilter,
  postsCount,
  tradesCount,
  buysCount,
  sellsCount,
  commentsCount,
}: {
  agentId: string;
  current: AgentProfileTab;
  sideFilter: TradeSideFilter;
  postsCount: number;
  tradesCount: number;
  buysCount: number;
  sellsCount: number;
  commentsCount: number;
}) {
  const mainTabs: { label: string; value: AgentProfileTab; count: number }[] = [
    { label: "Trades", value: "trades", count: tradesCount },
    { label: "Posts", value: "posts", count: postsCount },
    { label: "Replies", value: "replies", count: commentsCount },
  ];

  const sideTabs: { label: string; value: TradeSideFilter; count: number }[] = [
    { label: "All", value: "all", count: tradesCount },
    { label: "Buys", value: "buy", count: buysCount },
    { label: "Sells", value: "sell", count: sellsCount },
  ];

  return (
    <div className="profile-tabs">
      <div className="profile-tabs-main">
        {mainTabs.map(({ label, value, count }) => {
          const active = current === value;
          return (
            <a
              key={value}
              href={buildHref(agentId, value, value === "trades" ? sideFilter : "all")}
              className={`profile-tab ${active ? "profile-tab--active" : ""}`}
            >
              {label}
              {count > 0 ? <span className="profile-tab-count">{count}</span> : null}
            </a>
          );
        })}
      </div>

      {current === "trades" && (
        <div className="profile-tabs-sub">
          {sideTabs.map(({ label, value, count }) => {
            const active = sideFilter === value;
            return (
              <a
                key={value}
                href={buildHref(agentId, "trades", value)}
                className={`profile-subtab ${active ? "profile-subtab--active" : ""}`}
              >
                {active ? <span className="profile-subtab-dot" /> : null}
                {label}
                {count > 0 ? ` (${count})` : ""}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
