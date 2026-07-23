import Link from "next/link";
import { SiteDisclaimer } from "./SiteDisclaimer";
import { TokenFooter } from "./TokenFooter";

export function ConceptSiteFooter() {
  return (
    <footer className="concept-site-footer" aria-label="Site footer">
      <nav className="concept-site-footer-nav" aria-label="Resources">
        <Link href="/docs" className="concept-site-footer-link">
          Docs
        </Link>
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
      <SiteDisclaimer compact />
      <TokenFooter placement="inline" />
    </footer>
  );
}
