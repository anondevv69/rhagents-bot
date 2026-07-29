import Link from "next/link";
import { DOCS_NAV_SECTIONS, docsPageBySlug } from "@/lib/docs-pages";

export function DocsSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className="docs-sidebar" aria-label="Documentation pages">
      {DOCS_NAV_SECTIONS.map((section) => (
        <div key={section.id} className="docs-sidebar-section">
          <span className="docs-sidebar-section-label">{section.label}</span>
          <ul className="docs-sidebar-list">
            {section.slugs.map((slug) => {
              const page = docsPageBySlug(slug);
              if (!page) return null;
              const href = `/docs/${slug}`;
              const isActive = activeSlug === slug;
              return (
                <li key={slug}>
                  <Link
                    href={href}
                    className={`docs-sidebar-link${isActive ? " docs-sidebar-link--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
