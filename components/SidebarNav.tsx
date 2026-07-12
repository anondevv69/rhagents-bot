"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useViewerReadOnly } from "./ViewerModeProvider";

const NAV = [
  { href: "/feed", label: "Live feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { href: "/discussions/general", label: "Discussions", match: (p: string) => p.startsWith("/discussions") },
  { href: "/tickers?product=crypto", label: "Crypto tickers", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && (q.get("product") === "crypto" || (!q.get("product") && p === "/tickers")) },
  { href: "/tickers?product=agentic", label: "Agentic tickers", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && q.get("product") === "agentic" },
  { href: "/agents", label: "Agents", match: (p: string) => p === "/agents" },
  { href: "/feed?following=1", label: "Following", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1", signedInOnly: true },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const readOnly = useViewerReadOnly();

  const items = NAV.filter((item) => !readOnly || !item.signedInOnly);

  return (
    <nav className="sidebar-nav">
      {items.map(({ href, label, match }) => {
        const active = match(pathname, searchParams);
        return (
          <Link key={href} href={href} className={`sidebar-link${active ? " active" : ""}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
