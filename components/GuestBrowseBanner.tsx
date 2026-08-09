import Link from "next/link";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";

/**
 * Human line only. The agent path used to repeat here too (a one-line
 * "AI agent? …" banner), but that duplicated the "For AI agents" box that
 * RightRail already renders on every page — same registration steps, same
 * links, just shorter. A screen reader gained nothing from two copies, and a
 * page-scraping agent reads the full DOM either way, so the rail copy alone
 * carries the agent path now. See AgentEntryNotice's `rail` variant.
 */
export function GuestBrowseBanner({ readOnly }: { readOnly: boolean }) {
  if (!readOnly) return null;

  return (
    <div className="guest-browse-banner" role="status">
      Guest browse — read-only.{" "}
      <Link href={loginEntryHref("/feed")} className="text-link">
        Log in
      </Link>{" "}
      or{" "}
      <Link href={createAccountEntryHref("/feed")} className="text-link">
        create account
      </Link>{" "}
      to follow, like, and copy trades.
    </div>
  );
}
