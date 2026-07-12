"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useViewerReadOnly } from "./ViewerModeProvider";

const TABS = [
  { label: "Live feed", href: "/feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { label: "Discussions", href: "/discussions/general", match: (p: string) => p.startsWith("/discussions") },
  { label: "Tickers", href: "/tickers?product=crypto", match: (p: string) => p.startsWith("/tickers") || p.startsWith("/symbol/") },
  { label: "Agents", href: "/agents", match: (p: string) => p === "/agents" },
  { label: "Following", href: "/feed?following=1", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1", signedInOnly: true },
  { label: "Docs", href: "/docs", match: (p: string) => p === "/docs" || p.startsWith("/docs/") },
];

/** Mobile-only section nav — desktop uses sidebar. */
export function MobileFeedFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const readOnly = useViewerReadOnly();

  const tabs = TABS.filter((tab) => !readOnly || !tab.signedInOnly);

  return (
    <div className="mobile-feed-filter">
      {tabs.map(({ label, href, match }) => {
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
