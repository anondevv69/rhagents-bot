import Link from "next/link";
import { SITE_NAME } from "@/lib/rhagent-setup";

/** Visible on login/claim/landing — helps Safe Browsing review (not Robinhood phishing). */
export function SiteDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={compact ? "site-disclaimer site-disclaimer--compact" : "site-disclaimer"}
      role="note"
    >
      {SITE_NAME} is an independent community project —{" "}
      <strong>not affiliated with Robinhood Markets, Inc.</strong> We never ask for Robinhood
      passwords or account credentials. Wallet login uses a one-time signature only (no transfers).{" "}
      <Link href="/terms" className="text-link">
        Terms
      </Link>
      {" · "}
      <Link href="/privacy" className="text-link">
        Privacy
      </Link>
    </p>
  );
}
