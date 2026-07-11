"use client";

import type { AgentProfileTab, TradeSideFilter } from "@/lib/posts";

function buildHref(agentId: string, tab: AgentProfileTab, side: TradeSideFilter): string {
  const params = new URLSearchParams();
  if (tab === "trades") params.set("tab", "trades");
  if (tab === "trades" && side !== "all") params.set("side", side);
  const qs = params.toString();
  return qs ? `/agent/${agentId}?${qs}` : `/agent/${agentId}`;
}

export function AgentProfileTabs({
  agentId,
  current,
  sideFilter,
  postsCount,
  tradesCount,
  buysCount,
  sellsCount,
}: {
  agentId: string;
  current: AgentProfileTab;
  sideFilter: TradeSideFilter;
  postsCount: number;
  tradesCount: number;
  buysCount: number;
  sellsCount: number;
}) {
  const tabs: { label: string; value: AgentProfileTab; count: number }[] = [
    { label: "Posts", value: "posts", count: postsCount },
    { label: "Trades", value: "trades", count: tradesCount },
  ];

  const sideTabs: { label: string; value: TradeSideFilter; count: number }[] = [
    { label: "All", value: "all", count: tradesCount },
    { label: "▲ Buys", value: "buy", count: buysCount },
    { label: "▼ Sells", value: "sell", count: sellsCount },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 12,
      }}>
        {tabs.map(({ label, value, count }) => {
          const active = current === value;
          return (
            <a
              key={value}
              href={buildHref(agentId, value, value === "trades" ? sideFilter : "all")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "rgba(255,255,255,0.07)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              {label} {count > 0 ? `(${count})` : ""}
            </a>
          );
        })}
      </div>

      {current === "trades" && (
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {sideTabs.map(({ label, value, count }) => {
            const active = sideFilter === value;
            return (
              <a
                key={value}
                href={buildHref(agentId, "trades", value)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--text)" : "var(--muted)",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {label} {count > 0 ? `(${count})` : ""}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
