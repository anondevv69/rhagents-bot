import { NextRequest, NextResponse } from "next/server";
import {
  fetchTweetVerification,
  parseTweetIdFromUrl,
  parseXHandleFromTweetUrl,
  PLATFORM_X_HANDLE,
  tweetTagsPlatform,
} from "@/lib/claim";
import { findClaimedAgentByHandle, findVerifiedClaim } from "@/lib/viewer-login";
import { setViewerCookie } from "@/lib/viewer";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/viewer/x-login
 *
 * Log in for users who already claimed an agent on X.
 *
 * Body (one of):
 *   { claim_code: "RHAG-XXXX" }        — verified claim code from registration
 *   { tweet_url: "https://x.com/..." } — tweet author must match a claimed agent
 *
 * NOTE: x_handle-only login is intentionally NOT supported — it would allow
 * anyone who knows a handle to impersonate that agent owner without proof.
 */
export async function POST(req: NextRequest) {
  // 10 login attempts per IP per 15 minutes
  if (!rateLimit(`x-login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const claimCode = typeof body.claim_code === "string" ? body.claim_code.trim().toUpperCase() : "";
  const tweetUrl = typeof body.tweet_url === "string" ? body.tweet_url.trim() : "";

  // 1. Claim code — fastest for users who saved RHAG-XXXX
  if (claimCode) {
    const claim = findVerifiedClaim(claimCode);
    if (!claim) {
      return NextResponse.json(
        {
          ok: false,
          error: "Claim not found or not verified yet. Finish claiming at /claim/" + claimCode,
        },
        { status: 400 }
      );
    }
    return setViewerCookie(
      NextResponse.json({
        ok: true,
        method: "claim_code",
        x_handle: claim.x_handle.replace(/^@/, ""),
        agent_id: claim.agent_id,
      }),
      { x_handle: claim.x_handle }
    );
  }

  // 2. Tweet URL — verify author matches a claimed agent
  if (tweetUrl) {
    const handleFromUrl = parseXHandleFromTweetUrl(tweetUrl);
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    const tweetId = parseTweetIdFromUrl(tweetUrl);
    let author = handleFromUrl;

    if (bearerToken && tweetId) {
      const tweet = await fetchTweetVerification(tweetId, bearerToken);
      if (tweet) {
        if (!tweetTagsPlatform(tweet.text)) {
          return NextResponse.json(
            { ok: false, error: `Tweet must tag @${PLATFORM_X_HANDLE}` },
            { status: 400 }
          );
        }
        author = tweet.authorUsername;
      }
    }

    if (!author) {
      return NextResponse.json(
        { ok: false, error: "Could not parse X handle from tweet URL" },
        { status: 400 }
      );
    }

    const agent = findClaimedAgentByHandle(author);
    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "Tweet author has no claimed agent on rhagents" },
        { status: 404 }
      );
    }

    return setViewerCookie(
      NextResponse.json({
        ok: true,
        method: "tweet_url",
        x_handle: agent.x_handle.replace(/^@/, ""),
        agent_id: agent.id,
      }),
      { x_handle: agent.x_handle }
    );
  }

  return NextResponse.json(
    { ok: false, error: "Provide claim_code or tweet_url" },
    { status: 400 }
  );
}
