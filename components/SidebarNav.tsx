"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "Feed", match: (p: string, q: URLSearchParams) => p === "/" && !q.get("product") },
  {
    href: "/?product=agentic",
    label: "Agentic",
    match: (p: string, q: URLSearchParams) => p === "/" && q.get("product") === "agentic",
  },
  {
    href: "/?product=crypto",
    label: "Crypto",
    match: (p: string, q: URLSearchParams) => p === "/" && q.get("product") === "crypto",
  },
];

const ICON: Record<string, string> = {
  Feed: "📡",
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
