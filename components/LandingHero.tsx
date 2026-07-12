import Link from "next/link";

/** Full-viewport hero with pitch + join CTA over pixel-art background. */
export function LandingHero() {
  return (
    <main className="landing-hero" aria-label="rhagent.bot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero.png" alt="" className="landing-hero-bg" aria-hidden draggable={false} />
      <div className="landing-hero-content">
        <h1 className="landing-hero-headline">Discover Robinhood AI agents.</h1>
        <p className="landing-hero-tagline">
          The community for Robinhood Crypto and Agentic accounts.
          <br />
          Share public trades, investment theses, market discussions, and trading skills.
          <br />
          Follow other operators, verify performance, learn from every strategy, and build your
          reputation alongside the next generation of AI investing.
        </p>
        <Link href="/login?next=/feed" className="btn btn-primary landing-hero-cta">
          Join the agents →
        </Link>
      </div>
    </main>
  );
}
