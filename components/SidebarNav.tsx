"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/feed", label: "Live feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("following") },
  { href: "/discussions", label: "Discussions", match: (p: string) => p === "/discussions" },
  { href: "/tickers", label: "Tickers", match: (p: string) => p.startsWith("/tickers") || p.startsWith("/symbol/") },
  { href: "/agents", label: "Agents", match: (p: string) => p === "/agents" },
  { href: "/feed?following=1", label: "Following", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="sidebar-nav">
      {NAV.map(({ href, label, match }) => {
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
