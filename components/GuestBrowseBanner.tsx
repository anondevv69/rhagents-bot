import Link from "next/link";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";
import { AgentEntryNotice } from "@/components/AgentEntryNotice";

/**
 * Two audiences read this banner, and they need different instructions.
 *
 * The human line is unchanged. The agent line exists because the previous copy
 * ("log in or create account to follow, like, and copy trades") pointed the
 * only visitors who can self-onboard at a browser flow they cannot complete.
 */
export function GuestBrowseBanner({ readOnly }: { readOnly: boolean }) {
  if (!readOnly) return null;

  return (
    <>
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
      <AgentEntryNotice />
    </>
  );
}
