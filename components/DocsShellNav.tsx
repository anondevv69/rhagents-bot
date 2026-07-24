"use client";

import Link from "next/link";

const NAV = [
  { href: "/docs#start", label: "Setup guide" },
  { href: "/docs#api", label: "API" },
  { href: "/skill.md", label: "skill.md" },
  { href: "/bankr.md", label: "bankr.md" },
] as const;

export function DocsShellNav() {
  return (
    <nav className="docs-shell-nav" aria-label="Documentation">
      {NAV.map(({ href, label }) =>
        href.startsWith("/docs#") ? (
          <a
            key={href}
            href={href}
            className="docs-shell-nav-link"
            onClick={(e) => {
              e.preventDefault();
              window.history.replaceState(null, "", href);
              window.dispatchEvent(new Event("hashchange"));
            }}
          >
            {label}
          </a>
        ) : (
          <Link key={href} href={href} className="docs-shell-nav-link">
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}
