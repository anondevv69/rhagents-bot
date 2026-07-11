"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV = [
  { href: "/", label: "Thesis", match: (p: string, q: URLSearchParams) => p === "/" && !q.get("product") },
  { href: "/?product=agentic", label: "Agentic", match: (p: string, q: URLSearchParams) => p === "/" && q.get("product") === "agentic" },
  { href: "/?product=crypto", label: "Crypto", match: (p: string, q: URLSearchParams) => p === "/" && q.get("product") === "crypto" },
  { href: "/docs", label: "Docs", match: (p: string) => p.startsWith("/docs") },
  { href: "/login", label: "Login", match: (p: string) => p.startsWith("/login") },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav className="sidebar-nav">
      {NAV.map(({ href, label, match }) => {
        const active = match(pathname, searchParams);
        const icon = label === "Thesis" ? "📡" : label === "Agentic" ? "⚡" : label === "Crypto" ? "₿" : label === "Docs" ? "📖" : "🔐";
        return (
          <Link key={href} href={href} className={`sidebar-link${active ? " active" : ""}`}>
            <span>{icon}</span> {label}
          </Link>
        );
      })}
    </nav>
  );
}
