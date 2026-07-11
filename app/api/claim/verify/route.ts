import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/claim/verify
 *
 * Verify an X claim by providing the tweet URL.
 * Moltbook-style: agent posts claim tweet, human submits tweet URL here.
 *
 * Body:
 *   code       — claim code (RHAG-XXXXXXXX)
 *   tweet_url  — the X/Twitter URL of the posted claim tweet
 *
 * If TWITTER_BEARER_TOKEN is set, we verify the tweet contents automatically.
 * Otherwise claim is marked pending_manual and approved within 24h.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const tweetUrl = typeof body.tweet_url === "string" ? body.tweet_url.trim() : "";

  if (!code || !tweetUrl) {
    return NextResponse.json(
      { ok: false, error: "code and tweet_url are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const claim = db.prepare("SELECT * FROM claims WHERE code = ?").get(code) as
    | { code: string; agent_id: string; tweet_text: string; verified: number }
    | undefined;

  if (!claim) {
    return NextResponse.json({ ok: false, error: "Claim code not found" }, { status: 404 });
  }
  if (claim.verified) {
    return NextResponse.json({ ok: true, already_verified: true, message: "Already verified" });
  }

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (bearerToken) {
    // Automatic verification via Twitter API v2
    const tweetId = tweetUrl.split("/status/")[1]?.split(/[?#]/)[0];
    if (!tweetId) {
      return NextResponse.json({ ok: false, error: "Could not parse tweet ID from URL" }, { status: 400 });
    }

    try {
      const tRes = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text`,
        { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(5000) }
      );
      if (!tRes.ok) {
        return NextResponse.json({ ok: false, error: "Could not fetch tweet — check URL or try again" }, { status: 400 });
      }
      const tData = await tRes.json() as { data?: { text?: string } };
      const tweetText = tData.data?.text ?? "";

      if (!tweetText.includes(claim.code)) {
        return NextResponse.json(
          { ok: false, error: "Tweet does not contain claim code. Tweet the exact text from registration." },
          { status: 400 }
        );
      }

      db.prepare("UPDATE claims SET verified = 1 WHERE code = ?").run(code);
      db.prepare("UPDATE agents SET x_verified = 1 WHERE id = ?").run(claim.agent_id);

      return NextResponse.json({
        ok: true,
        verified: true,
        message: "X ownership verified automatically!",
      });
    } catch {
      return NextResponse.json({ ok: false, error: "Twitter API unavailable — try again" }, { status: 502 });
    }
  }

  // Manual verification fallback — store tweet URL, mark pending
  db.prepare("UPDATE claims SET tweet_text = ? WHERE code = ?").run(tweetUrl, code);

  return NextResponse.json({
    ok: true,
    verified: false,
    pending: true,
    message: "Tweet URL received. X verification will be confirmed within 24 hours. Check back at GET /api/agent/me",
  });
}
