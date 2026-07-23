import Link from "next/link";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";

export function AuthEntryButtons({
  next = "/feed",
  size = "default",
}: {
  next?: string;
  size?: "default" | "compact" | "hero";
}) {
  const loginHref = loginEntryHref(next);
  const createHref = createAccountEntryHref(next);

  if (size === "hero") {
    return (
      <div className="landing-hero-actions">
        <Link href={createHref} className="btn btn-primary landing-hero-cta">
          Create account
        </Link>
        <Link href={loginHref} className="btn btn-outline landing-hero-cta">
          Log in
        </Link>
      </div>
    );
  }

  const btnStyle = size === "compact" ? { fontSize: 12, flexShrink: 0 as const } : undefined;

  return (
    <div className="auth-entry-buttons">
      <Link href={loginHref} className="btn btn-ghost" style={btnStyle}>
        Log in
      </Link>
      <Link href={createHref} className="btn btn-primary" style={btnStyle}>
        Create account
      </Link>
    </div>
  );
}
