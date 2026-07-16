import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/** Top-right links on the landing page — agent login/create only (browse is the hero CTA). */
export function LandingNav() {
  return (
    <nav className="landing-nav" aria-label="Site">
      <ThemeToggle />
      <Link href="/login?next=/feed" className="landing-nav-link">
        Log in
      </Link>
      <Link href="/login?mode=create&next=/feed" className="landing-nav-link landing-nav-link--accent">
        Create account
      </Link>
    </nav>
  );
}
