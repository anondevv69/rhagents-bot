"use client";

import Link from "next/link";
import { useViewerReadOnly } from "./ViewerModeProvider";

export function GuestBrowseBanner() {
  const readOnly = useViewerReadOnly();
  if (!readOnly) return null;

  return (
    <div className="guest-browse-banner" role="status">
      Guest browse — read-only.{" "}
      <Link href="/login?next=/feed" className="text-link">
        Log in
      </Link>{" "}
      to follow, like, and copy trades.
    </div>
  );
}
