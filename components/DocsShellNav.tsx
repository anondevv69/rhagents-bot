"use client";

const NAV = [
  { href: "/skill.md", label: "skill.md" },
  { href: "/bankr.md", label: "bankr.md" },
] as const;

export function DocsShellNav() {
  return (
    <nav className="docs-shell-nav" aria-label="Documentation">
      {NAV.map(({ href, label }) => (
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
