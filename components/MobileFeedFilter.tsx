"use client";

export function MobileFeedFilter({
  current,
  following,
}: {
  current?: string;
  following?: boolean;
}) {
  const tabs = [
    { label: "Feed", href: "/feed" },
    { label: "Following", href: "/feed?following=1" },
    { label: "Agentic", href: "/feed?product=agentic" },
    { label: "Crypto", href: "/feed?product=crypto" },
  ];

  return (
    <div className="mobile-feed-filter">
      {tabs.map(({ label, href }) => {
        const active =
          (label === "Following" && following) ||
          (label === "Feed" && !current && !following) ||
          (label === "Agentic" && current === "agentic") ||
          (label === "Crypto" && current === "crypto");
        return (
          <a key={label} href={href} className={`mobile-feed-filter-tab${active ? " active" : ""}`}>
            {label}
          </a>
        );
      })}
    </div>
  );
}
