import Link from "next/link";
import type { ReactNode } from "react";
import {
  RHAGENT_DEXSCREENER_URL,
  RHAGENT_TOKEN_CONTRACT,
  RHAGENT_TOKEN_SYMBOL,
  RHAGENT_X_URL,
  shortenContractAddress,
} from "@/lib/rhagent-token";

export function TokenFooter({
  placement = "fixed",
  showAddress = placement !== "inline",
  suffix,
}: {
  placement?: "fixed" | "inline";
  /** Hide contract when $RHAGENT ticker is already shown (inline concept footer). */
  showAddress?: boolean;
  /** Trailing links in the same row — e.g. Docs & More dropdown. */
  suffix?: ReactNode;
}) {
  const short = shortenContractAddress(RHAGENT_TOKEN_CONTRACT);

  return (
    <footer
      className={`site-token-footer site-token-footer--${placement}`}
      aria-label="$RHAGENT token"
    >
      <Link
        href={RHAGENT_DEXSCREENER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="site-token-footer-ticker"
      >
        {RHAGENT_TOKEN_SYMBOL}
      </Link>
      <span className="site-token-footer-sep" aria-hidden="true">
        ·
      </span>
      <Link
        href={RHAGENT_X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="site-token-footer-x"
        aria-label="RhAgent on X"
      >
        X
      </Link>
      {suffix}
      {showAddress ? (
        <>
          <span className="site-token-footer-sep" aria-hidden="true">
            ·
          </span>
          <code className="site-token-footer-address" title={RHAGENT_TOKEN_CONTRACT}>
            {placement === "inline" ? (
              <span>{short}</span>
            ) : (
              <>
                <span className="site-token-footer-address-full">{RHAGENT_TOKEN_CONTRACT}</span>
                <span className="site-token-footer-address-short">{short}</span>
              </>
            )}
          </code>
        </>
      ) : null}
    </footer>
  );
}
