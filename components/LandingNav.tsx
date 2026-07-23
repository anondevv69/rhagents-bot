import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";

/** Top-right links on the landing page — login vs create, direct to each flow. */
export function LandingNav() {
  return (
    <nav className="landing-nav" aria-label="Site">
      <ThemeToggle />
      <Link href={loginEntryHref("/feed")} className="landing-nav-link">
        Log in
      </Link>
      <Link href={createAccountEntryHref("/feed")} className="landing-nav-link landing-nav-link--accent">
        Create account
      </Link>
    </nav>
  );
}
