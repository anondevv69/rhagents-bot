"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { label: "Live", href: "/feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { label: "Discussions", href: "/discussions", match: (p: string) => p === "/discussions" },
  { label: "Tickers", href: "/tickers", match: (p: string) => p === "/tickers" },
  { label: "Agents", href: "/agents", match: (p: string) => p === "/agents" },
  { label: "Following", href: "/feed?following=1", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1" },
];

export function MobileFeedFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="mobile-feed-filter">
      {TABS.map(({ label, href, match }) => {
        const active = match(pathname, searchParams);
        return (
          <Link key={label} href={href} className={`mobile-feed-filter-tab${active ? " active" : ""}`}>
            {label}
          </Link>
        );
      })}
    </div>
  );
}
