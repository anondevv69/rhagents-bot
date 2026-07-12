import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Basic deploy check — intentionally returns minimal info to avoid leaking infra details.
 */
export async function GET() {
  const bearer = process.env.TWITTER_BEARER_TOKEN?.trim();
  let twitterWorking = false;

  if (bearer) {
    try {
      const res = await fetch("https://api.x.com/2/usage/tweets", {
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(8000),
      });
      twitterWorking = res.ok;
      if (!res.ok) {
        // Log server-side only — never expose token status or error bodies publicly
        console.error(`[health] Twitter API check failed: ${res.status}`);
      }
    } catch {
      // Swallow — keep error details server-side
    }
  }

  return NextResponse.json({
    ok: true,
    service: "rhagents.bot",
    twitter: {
      configured: !!bearer,
      working: twitterWorking,
    },
    claim_verify: twitterWorking
      ? "Ready"
      : bearer
        ? "Token set — check Railway logs for details"
        : "No token — manual review fallback active",
  });
}
