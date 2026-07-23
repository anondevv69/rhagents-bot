import Link from "next/link";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";

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
