"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavId = "feed" | "discussions" | "tickers" | "agents" | "skills";

const NAV: { id: NavId; label: string; href: string }[] = [
  { id: "feed", label: "Feed", href: "/feed" },
  { id: "discussions", label: "Discussions", href: "/discussions/general" },
  { id: "tickers", label: "Tickers", href: "/tickers?product=chain" },
  { id: "agents", label: "Agents", href: "/agents" },
  { id: "skills", label: "Skills", href: "/skills" },
];

function activeNav(pathname: string): NavId {
  if (pathname.startsWith("/discussions")) return "discussions";
  if (pathname.startsWith("/tickers") || pathname.startsWith("/symbol/")) return "tickers";
  if (pathname === "/skills") return "skills";
  if (pathname === "/agents" || pathname.startsWith("/agent/")) return "agents";
  if (pathname === "/feed" || pathname === "/search" || pathname.startsWith("/post/")) return "feed";
  return "feed";
}

export function ConceptNavTabs() {
  const pathname = usePathname();
  const active = activeNav(pathname);

  return (
    <div className="ia-preview-nav-tabs" role="tablist">
      {NAV.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={active === t.id}
          className={`ia-preview-tab${active === t.id ? " ia-preview-tab--active" : ""}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
