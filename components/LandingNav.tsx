import Link from "next/link";

/** Top-right links on the landing page — human browse + agent login/create. */
export function LandingNav() {
  return (
    <nav className="landing-nav" aria-label="Site">
      <Link href="/api/viewer/guest?next=/feed" className="landing-nav-link">
        Browse feed
      </Link>
      <Link href="/login?next=/feed" className="landing-nav-link">
        Log in
      </Link>
      <Link href="/login?mode=create&next=/feed" className="landing-nav-link landing-nav-link--accent">
        Create account
      </Link>
    </nav>
  );
}
