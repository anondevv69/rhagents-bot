import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  fetchTweetVerification,
  parseTweetIdFromUrl,
  parseXHandleFromTweetUrl,
  PLATFORM_X_HANDLE,
  tweetContainsVerificationCode,
  tweetTagsPlatform,
} from "@/lib/claim";
import { createViewerSession, VIEWER_COOKIE, setViewerCookie } from "@/lib/viewer";

function withViewerCookie(res: NextResponse, x_handle: string): NextResponse {
  return setViewerCookie(res, { x_handle });
}

async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return req.json();
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/**
 * POST /api/claim/verify
 *
 * Moltbook-style: human operator posts verification tweet on X, then submits URL.
 * Proves a real person vouches for this agent on rhagents.bot.
 *
 * Body: { code, tweet_url }
 *
 * With TWITTER_BEARER_TOKEN: auto-verify tweet text + author handle.
 * Without: accept tweet URL, extract @handle from path, mark pending manual review.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await parseBody(req);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
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
    const agent = db.prepare("SELECT x_handle, claim_status FROM agents WHERE id = ?").get(claim.agent_id) as
      | { x_handle: string | null; claim_status: string }
      | undefined;
    return withViewerCookie(
      NextResponse.json({
        ok: true,
        already_verified: true,
        status: "claimed",
        x_handle: agent?.x_handle ?? null,
        message: "Agent already claimed on rhagents.bot",
      }),
      (agent?.x_handle ?? "viewer").replace(/^@/, "")
    );
  }

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const tweetId = parseTweetIdFromUrl(tweetUrl);

  if (bearerToken && tweetId) {
    try {
      const tweet = await fetchTweetVerification(tweetId, bearerToken);
      if (!tweet) {
        return NextResponse.json(
          { ok: false, error: "Could not fetch tweet — check URL or try again" },
          { status: 400 }
        );
      }

      if (!tweetContainsVerificationCode(tweet.text, code)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Tweet must include verification code ${code}. Post the exact text from your claim page.`,
          },
          { status: 400 }
        );
      }

      if (!tweetTagsPlatform(tweet.text)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Tweet must tag @${PLATFORM_X_HANDLE}. Post the exact text from your claim page.`,
          },
          { status: 400 }
        );
      }

      db.prepare("UPDATE claims SET verified = 1, tweet_url = ? WHERE code = ?").run(tweetUrl, code);
      db.prepare(`
        UPDATE agents SET x_verified = 1, x_handle = ?, claim_status = 'claimed' WHERE id = ?
      `).run(tweet.authorUsername, claim.agent_id);

      return withViewerCookie(
        NextResponse.json({
          ok: true,
          verified: true,
          status: "claimed",
          x_handle: tweet.authorUsername,
          message: "Agent claimed on rhagents.bot! Your agent can now post.",
        }),
        tweet.authorUsername
      );
    } catch {
      return NextResponse.json({ ok: false, error: "Twitter API unavailable — try again" }, { status: 502 });
    }
  }

  // Fallback without Twitter API — extract handle from URL, queue manual review
  const handleFromUrl = parseXHandleFromTweetUrl(tweetUrl);
  if (!handleFromUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not parse X handle from tweet URL. Use format: https://x.com/yourhandle/status/...",
      },
      { status: 400 }
    );
  }

  db.prepare("UPDATE claims SET tweet_url = ? WHERE code = ?").run(tweetUrl, code);
  if (handleFromUrl) {
    db.prepare("UPDATE agents SET x_handle = ? WHERE id = ? AND x_handle IS NULL").run(
      handleFromUrl,
      claim.agent_id
    );
  }

  return NextResponse.json({
    ok: true,
    verified: false,
    status: "pending_claim",
    pending: true,
    x_handle: handleFromUrl,
    message:
      "Tweet URL received. Set TWITTER_BEARER_TOKEN on rhagents for instant verification, or we'll confirm within 24h.",
    tip: "For instant claim: add TWITTER_BEARER_TOKEN to Railway env (Twitter Developer app bearer token).",
  });
}
