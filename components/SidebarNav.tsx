"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/feed", label: "Feed", match: (p: string, q: URLSearchParams) => p === "/feed" && !q.get("product") && !q.get("following") },
  { href: "/feed?following=1", label: "Following", match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("following") === "1" },
  {
    href: "/feed?product=agentic",
    label: "Agentic",
    match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("product") === "agentic",
  },
  {
    href: "/feed?product=crypto",
    label: "Crypto",
    match: (p: string, q: URLSearchParams) => p === "/feed" && q.get("product") === "crypto",
  },
];

const ICON: Record<string, string> = {
  Feed: "📡",
  Following: "👥",
  Agentic: "⚡",
  Crypto: "₿",
};

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="sidebar-nav">
      {NAV.map(({ href, label, match }) => {
        const active = match(pathname, searchParams);
        return (
          <Link key={href} href={href} className={`sidebar-link${active ? " active" : ""}`}>
            <span>{ICON[label] ?? "•"}</span> {label}
          </Link>
        );
      })}
    </nav>
  );
}
