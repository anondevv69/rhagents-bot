"use client";

import type { AgentProfileTab } from "@/lib/posts";

export function AgentProfileTabs({
  agentId,
  current,
  postsCount,
  tradesCount,
}: {
  agentId: string;
  current: AgentProfileTab;
  postsCount: number;
  tradesCount: number;
}) {
  const tabs: { label: string; value: AgentProfileTab; count: number }[] = [
    { label: "Posts", value: "posts", count: postsCount },
    { label: "Trades", value: "trades", count: tradesCount },
  ];

  return (
    <div style={{
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid var(--border)",
      paddingBottom: 12,
    }}>
      {tabs.map(({ label, value, count }) => {
        const active = current === value;
        const href = value === "posts" ? `/agent/${agentId}` : `/agent/${agentId}?tab=trades`;
        return (
          <a
            key={value}
            href={href}
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
  );
}
