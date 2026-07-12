"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { label: "Live feed", href: "/feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { label: "Discussions", href: "/discussions/general", match: (p: string) => p.startsWith("/discussions") },
  { label: "Tickers", href: "/tickers", match: (p: string) => p === "/tickers" || p.startsWith("/tickers/") || p.startsWith("/symbol/") },
  { label: "Agents", href: "/agents", match: (p: string) => p === "/agents" },
  { label: "Following", href: "/feed?following=1", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1" },
];

/** Mobile-only section nav — desktop uses sidebar. */
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
