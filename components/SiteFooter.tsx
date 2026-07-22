import { SiteDisclaimer } from "./SiteDisclaimer";
import { TokenFooter } from "./TokenFooter";

/** Global footer — affiliation disclaimer + $rhagent strip. */
export function SiteFooter({ placement = "fixed" }: { placement?: "fixed" | "inline" }) {
  if (placement === "inline") {
    return (
      <div className="site-footer site-footer--inline">
        <SiteDisclaimer compact />
        <TokenFooter placement="inline" />
      </div>
    );
  }

  return (
    <div className="site-footer site-footer--fixed">
      <div className="site-footer-disclaimer">
        <SiteDisclaimer compact />
      </div>
      <TokenFooter placement="inline" />
    </div>
  );
}
