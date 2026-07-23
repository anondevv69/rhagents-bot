import Link from "next/link";
import { TokenFooter } from "./TokenFooter";
import { getDocsPageUrl } from "@/lib/rhagent-setup";

export function ConceptSiteFooter() {
  const docsHref = getDocsPageUrl();

  return (
    <footer className="concept-site-footer" aria-label="Site footer">
      <nav className="concept-site-footer-nav" aria-label="Resources">
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
      <TokenFooter placement="inline" />
    </footer>
  );
}
