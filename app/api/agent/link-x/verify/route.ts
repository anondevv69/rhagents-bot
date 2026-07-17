import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import {
  fetchTweetVerification,
  parseTweetIdFromUrl,
  parseXHandleFromTweetUrl,
  PLATFORM_X_HANDLE,
  tweetContainsVerificationCode,
  tweetTagsPlatform,
} from "@/lib/claim";
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { setViewerCookie } from "@/lib/viewer";

/**
 * POST /api/agent/link-x/verify
 * Body: { agent_id, code, tweet_url }
 *
 * Attach owner_x_handle to an already-claimed agent (e.g. MetaMask account).
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`link-x-verify:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "Log in to verify X link." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const tweetUrl = typeof body.tweet_url === "string" ? body.tweet_url.trim() : "";

  if (!agentId || !code || !tweetUrl) {
    return NextResponse.json(
      { ok: false, error: "agent_id, code, and tweet_url are required" },
      { status: 400 },
    );
  }

  if (!rateLimit(`link-x-verify:${viewerIdentityKey(session!)}:${agentId}`, 15, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as
    | {
        id: string;
        owner_x_handle: string | null;
        owner_telegram_id: string | null;
        owner_discord_id: string | null;
        chain_wallet: string | null;
        x_verified: number;
        claim_status: string;
      }
    | undefined;

  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  if (!viewerOwnsAgent(session, agent)) {
    return NextResponse.json({ ok: false, error: "Only the verified owner can link X." }, { status: 403 });
  }

  const row = db
    .prepare(
      `SELECT code, agent_id, channel, used, expires_at FROM owner_link_codes WHERE code = ?`,
    )
    .get(code) as
    | { code: string; agent_id: string; channel: string; used: number; expires_at: string }
    | undefined;

  if (!row || row.channel !== "x" || row.agent_id !== agentId) {
    return NextResponse.json(
      { ok: false, error: "Invalid or mismatched link code. Generate a new one from Settings → Link X." },
      { status: 404 },
    );
  }
  if (row.used) {
    return NextResponse.json({ ok: false, error: "That link code was already used." }, { status: 409 });
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: "That link code expired. Generate a new one." }, { status: 400 });
  }

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const tweetId = parseTweetIdFromUrl(tweetUrl);

  let handle: string | null = null;
  let fullyVerified = false;

  if (bearerToken && tweetId) {
    try {
      const tweet = await fetchTweetVerification(tweetId, bearerToken);
      if (!tweet) {
        return NextResponse.json(
          { ok: false, error: "Could not fetch tweet — check URL or try again" },
          { status: 400 },
        );
      }
      if (!tweetContainsVerificationCode(tweet.text, code)) {
        return NextResponse.json(
          { ok: false, error: `Tweet must include verification code ${code}.` },
          { status: 400 },
        );
      }
      if (!tweetTagsPlatform(tweet.text)) {
        return NextResponse.json(
          { ok: false, error: `Tweet must tag @${PLATFORM_X_HANDLE}.` },
          { status: 400 },
        );
      }
      handle = tweet.authorUsername.toLowerCase().replace(/^@/, "");
      fullyVerified = true;
    } catch {
      return NextResponse.json({ ok: false, error: "Twitter API unavailable — try again" }, { status: 502 });
    }
  } else {
    handle = parseXHandleFromTweetUrl(tweetUrl);
    if (!handle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not parse X handle from tweet URL. Use https://x.com/yourhandle/status/…",
        },
        { status: 400 },
      );
    }
  }

  const other = db
    .prepare(
      `SELECT id FROM agents
       WHERE id != ?
         AND (
           LOWER(REPLACE(COALESCE(owner_x_handle, ''), '@', '')) = ?
           OR LOWER(REPLACE(COALESCE(x_handle, ''), '@', '')) = ?
         )
       LIMIT 1`,
    )
    .get(agentId, handle, handle) as { id: string } | undefined;
  if (other) {
    return NextResponse.json(
      {
        ok: false,
        error: "x_handle_taken",
        message: `@${handle} already owns another rhagent account.`,
      },
      { status: 409 },
    );
  }

  if (fullyVerified) {
    db.prepare(
      `UPDATE agents
       SET owner_x_handle = ?, x_verified = 1, claim_status = 'claimed'
       WHERE id = ?`,
    ).run(handle, agentId);
  } else {
    db.prepare(
      `UPDATE agents
       SET owner_x_handle = ?, claim_status = 'claimed'
       WHERE id = ?`,
    ).run(handle, agentId);
  }

  db.prepare(`UPDATE owner_link_codes SET used = 1 WHERE code = ?`).run(code);

  const res = NextResponse.json({
    ok: true,
    verified: fullyVerified,
    owner_x_handle: handle,
    message: fullyVerified
      ? `X linked as @${handle}. You can now log in with X for this agent.`
      : `X handle @${handle} saved from URL. Full auto-verify needs TWITTER_BEARER_TOKEN — pending review if not set.`,
  });

  // Keep wallet session; also allow X cookie if they want to switch — merge not supported,
  // so only set X cookie when they weren't on wallet-only (optional). Prefer keeping current session.
  if (fullyVerified && !session?.chain_wallet) {
    return setViewerCookie(res, { x_handle: handle });
  }
  return res;
}
