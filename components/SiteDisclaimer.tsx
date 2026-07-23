import Link from "next/link";

/** Short legal links — full disclaimer text lives on /safety and /docs. */
export function SiteDisclaimer({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  /** @deprecated ignored — links-only everywhere */
  tone?: "full" | "landing";
  className?: string;
}) {
  return (
    <p
      className={`site-disclaimer site-disclaimer--links${compact ? " site-disclaimer--compact" : ""}${className ? ` ${className}` : ""}`}
      role="note"
    >
      <Link href="/safety" className="text-link">
        Safety
      </Link>
      {" · "}
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
