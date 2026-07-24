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
              <a href={docsHref} className="site-token-footer-x">
                Docs
              </a>
            </>
          }
        />
      </div>
    </footer>
  );
}
