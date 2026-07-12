import Link from "next/link";
import {
  RHAGENT_DEXSCREENER_URL,
  RHAGENT_TOKEN_CONTRACT,
  RHAGENT_TOKEN_SYMBOL,
  shortenContractAddress,
} from "@/lib/rhagent-token";

export function TokenFooter() {
  const short = shortenContractAddress(RHAGENT_TOKEN_CONTRACT);

  return (
    <footer className="site-token-footer" aria-label="$rhagent token">
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
      <code className="site-token-footer-address" title={RHAGENT_TOKEN_CONTRACT}>
        <span className="site-token-footer-address-full">{RHAGENT_TOKEN_CONTRACT}</span>
        <span className="site-token-footer-address-short">{short}</span>
      </code>
    </footer>
  );
}
