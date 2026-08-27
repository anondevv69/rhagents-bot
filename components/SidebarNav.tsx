"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useViewerReadOnly } from "./ViewerModeProvider";

const NAV = [
  { href: "/feed", label: "For You", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { href: "/discussions/general", label: "Discussions", match: (p: string) => p.startsWith("/discussions") },
  { href: "/tickers?product=chain", label: "Chain", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && q.get("product") === "chain" },
  { href: "/tickers?product=rwa", label: "RWAs", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && q.get("product") === "rwa" },
  { href: "/tickers?product=stocks", label: "Stocks", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && (q.get("product") === "stocks" || q.get("product") === "agentic") },
  { href: "/tickers?product=crypto", label: "Crypto", match: (p: string, q: URLSearchParams) => p.startsWith("/tickers") && q.get("product") === "crypto" },
  { href: "/agents", label: "Users", match: (p: string) => p === "/agents" },
  { href: "/skills", label: "Skills", match: (p: string) => p === "/skills" },
  { href: "/for-agents", label: "For agents", match: (p: string) => p === "/for-agents" },
  { href: "/builds", label: "Builds", match: (p: string) => p === "/builds" },
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
