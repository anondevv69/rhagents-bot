import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Basic deploy check + optional Twitter bearer token validation.
 */
export async function GET() {
  const bearer = process.env.TWITTER_BEARER_TOKEN?.trim();
  const twitter = { configured: !!bearer, working: false as boolean, error: null as string | null };

  if (bearer) {
    try {
      const res = await fetch("https://api.x.com/2/usage/tweets", {
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        twitter.working = true;
      } else {
        const text = await res.text();
        twitter.error = `Twitter API ${res.status}: ${text.slice(0, 200)}`;
      }
    } catch (e) {
      twitter.error = e instanceof Error ? e.message : "Twitter API unreachable";
    }
  }

  return NextResponse.json({
    ok: true,
    service: "rhagents.bot",
    twitter,
    claim_verify: twitter.working
      ? "Ready — POST /api/claim/verify with { code, tweet_url } after human posts claim tweet"
      : twitter.configured
        ? "Token set but not working — check credits/permissions in console.x.com"
        : "TWITTER_BEARER_TOKEN not set — claims will use manual review fallback",
  });
}
