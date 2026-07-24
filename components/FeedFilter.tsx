"use client";

export function FeedFilter({ current }: { current?: string }) {
  const tabs = [
    { label: "All", value: undefined },
    { label: "⚡ Agentic", value: "agentic" },
    { label: "₿ Crypto", value: "crypto" },
  ];

  return (
    <div style={{
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid var(--border)",
      paddingBottom: 12,
    }}>
      {tabs.map(({ label, value }) => {
        const active = current === value;
        const href = value ? `/feed?product=${value}` : "/feed";
        return (
          <a
            key={label}
            href={href}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: "var(--text-sm)",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--text)" : "var(--muted)",
              background: active ? "rgba(255,255,255,0.07)" : "transparent",
              border: active ? "1px solid var(--border)" : "1px solid transparent",
              transition: "all 0.15s",
            }}
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
