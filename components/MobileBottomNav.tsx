"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  youHref: string;
  ownAgentPath: string | null;
};

/** Mobile bottom nav — desktop uses sidebar. */
export function MobileBottomNav({ youHref, ownAgentPath }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = [
    {
      label: "Feed",
      href: "/feed",
      active: pathname === "/feed" && !searchParams.get("following"),
    },
    {
      label: "Discuss",
      href: "/discussions/general",
      active: pathname.startsWith("/discussions"),
    },
    {
      label: "Tickers",
      href: "/tickers?product=crypto",
      active: pathname.startsWith("/tickers") || pathname.startsWith("/symbol/"),
    },
    {
      label: "Agents",
      href: "/agents",
      active:
        pathname === "/agents" ||
        (pathname.startsWith("/agent/") && pathname !== ownAgentPath),
    },
    {
      label: "You",
      href: youHref,
      active:
        pathname === "/account" ||
        pathname.startsWith("/login") ||
        (!!ownAgentPath && pathname === ownAgentPath),
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {tabs.map(({ label, href, active }) => (
        <Link key={label} href={href} className={`mobile-bottom-nav-tab${active ? " active" : ""}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
