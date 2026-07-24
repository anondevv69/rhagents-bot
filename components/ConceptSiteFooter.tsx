import Link from "next/link";
import { TokenFooter } from "./TokenFooter";
import { SiteActivityStats } from "./SiteActivityStats";
import { getDocsPageUrl } from "@/lib/rhagent-setup";

export function ConceptSiteFooter() {
  const docsHref = getDocsPageUrl();

  return (
    <footer className="concept-site-footer" aria-label="Site footer">
      <SiteActivityStats />
      <div className="concept-site-footer-row">
        <TokenFooter
          placement="inline"
          showAddress={false}
          suffix={
            <>
              <span className="site-token-footer-sep" aria-hidden="true">
                ·
              </span>
              <details className="concept-site-footer-docs-more">
                <summary className="concept-site-footer-docs-more-summary">Docs &amp; More</summary>
                <nav className="concept-site-footer-docs-menu" aria-label="Docs and policies">
                  <a href={docsHref} className="concept-site-footer-link">
                    Docs
                  </a>
                  <Link href="/safety" className="concept-site-footer-link">
                    Safety
                  </Link>
                  <Link href="/terms" className="concept-site-footer-link">
                    Terms
                  </Link>
                  <Link href="/privacy" className="concept-site-footer-link">
                    Privacy
                  </Link>
                </nav>
              </details>
            </>
          }
        />
      </div>
    </footer>
  );
}
