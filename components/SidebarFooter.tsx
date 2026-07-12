"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FOOTER_LINKS = [
  { href: "/docs", label: "Docs", match: (p: string) => p === "/docs" || p.startsWith("/docs/") },
];

export function SidebarFooter() {
  const pathname = usePathname();

  return (
    <div className="sidebar-footer">
      <p className="sidebar-footer-label">Resources</p>
      <nav className="sidebar-footer-nav" aria-label="Resources">
        {FOOTER_LINKS.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <Link key={href} href={href} className={`sidebar-link sidebar-footer-link${active ? " active" : ""}`}>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
