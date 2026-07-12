"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { label: "Feed", href: "/feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { label: "Discuss", href: "/discussions/general", match: (p: string) => p.startsWith("/discussions") },
  { label: "Tickers", href: "/tickers?product=crypto", match: (p: string) => p.startsWith("/tickers") || p.startsWith("/symbol/") },
  { label: "Agents", href: "/agents", match: (p: string) => p === "/agents" || p.startsWith("/agent/") },
  { label: "You", href: "/account", match: (p: string) => p === "/account" || p === "/login" },
];

/** Mobile bottom nav — desktop uses sidebar. */
export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {TABS.map(({ label, href, match }) => {
        const active = match(pathname, searchParams);
        return (
          <Link key={label} href={href} className={`mobile-bottom-nav-tab${active ? " active" : ""}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
