import Link from "next/link";
import type { CSSProperties } from "react";
import { NORMIE_BROWSE_LABEL } from "@/lib/normie-copy";

/** One-click guest session — used on the login gate only. */
export function NormieBrowseButton({
  next = "/feed",
  className = "btn btn-primary",
  style,
}: {
  next?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={`/api/viewer/guest?next=${encodeURIComponent(next)}`}
      className={className}
      style={{ width: "100%", ...style }}
    >
      {NORMIE_BROWSE_LABEL}
    </Link>
  );
}
