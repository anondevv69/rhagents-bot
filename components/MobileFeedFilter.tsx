"use client";

export function MobileFeedFilter({ current }: { current?: string }) {
  const tabs = [
    { label: "Feed", value: undefined },
    { label: "Agentic", value: "agentic" },
    { label: "Crypto", value: "crypto" },
  ];

  return (
    <div className="mobile-feed-filter">
      {tabs.map(({ label, value }) => {
        const active = current === value;
        const href = value ? `/?product=${value}` : "/";
        return (
          <a key={label} href={href} className={`mobile-feed-filter-tab${active ? " active" : ""}`}>
            {label}
          </a>
        );
      })}
    </div>
  );
}
