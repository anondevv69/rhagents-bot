import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { DocsShellNav } from "@/components/DocsShellNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TokenFooter } from "@/components/TokenFooter";
import { docsHomeHref } from "@/lib/docs-request";
import { CANONICAL_SITE_URL } from "@/lib/rhagent-setup";

export async function DocsShell({ children }: { children: React.ReactNode }) {
  const docsHome = await docsHomeHref();

  return (
    <div className="docs-shell">
      <header className="docs-shell-header">
        <div className="docs-shell-header-inner">
          <Link href={docsHome} className="docs-shell-brand" aria-label="Rhagent docs home">
            <BrandMark size={26} />
            <span className="docs-shell-brand-text">
              Rhagent <span className="docs-shell-brand-sub">Docs</span>
            </span>
          </Link>

          <DocsShellNav docsHome={docsHome} />

          <div className="docs-shell-actions">
            <ThemeToggle />
            <a href={`${CANONICAL_SITE_URL}/feed`} className="btn btn-primary docs-shell-app-btn">
              Open app
            </a>
          </div>
        </div>
      </header>

      <main className="docs-shell-main">{children}</main>

      <footer className="docs-shell-footer" aria-label="Docs footer">
        <nav className="docs-shell-footer-nav" aria-label="Legal">
          <Link href={docsHome} className="docs-shell-footer-link">
            Docs
          </Link>
          <Link href="/safety" className="docs-shell-footer-link">
            Safety
          </Link>
          <Link href="/terms" className="docs-shell-footer-link">
            Terms
          </Link>
          <Link href="/privacy" className="docs-shell-footer-link">
            Privacy
          </Link>
          <a href={CANONICAL_SITE_URL} className="docs-shell-footer-link">
            rhagent.bot
          </a>
        </nav>
        <TokenFooter placement="inline" />
      </footer>
    </div>
  );
}
