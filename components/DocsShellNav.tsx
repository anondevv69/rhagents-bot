"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const EXTERNAL = [
  { href: "/skill.md", label: "skill.md" },
  { href: "/bankr.md", label: "bankr.md" },
] as const;

export function DocsShellNav({ docsHome }: { docsHome: string }) {
  const pathname = usePathname() ?? "";
  const onDocs =
    pathname === docsHome || pathname === "/docs" || pathname.startsWith("/docs/");

  return (
    <nav className="docs-shell-nav" aria-label="Documentation">
      <Link
        href={docsHome}
        className={`docs-shell-nav-link${onDocs ? " docs-shell-nav-link--current" : ""}`}
        aria-current={onDocs ? "page" : undefined}
      >
        Docs
      </Link>
      {EXTERNAL.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="docs-shell-nav-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
