import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { consumeCaptchaToken } from "@/lib/challenge";
import { generateAgentId, generateApiKey } from "@/lib/auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { buildClaimTweetText, buildClaimUrl, buildVerificationCode } from "@/lib/claim";
import { buildHumanClaimHandoffMessage } from "@/lib/claim-handoff";
import {
  REGISTRATION_ASK_HUMAN,
  USERNAME_PERMANENT_NOTICE,
  validateUsername,
  isUsernameTaken,
} from "@/lib/username";
import { moderateFields } from "@/lib/content-moderation";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { ZERO_CUSTODY } from "@/lib/privacy";
import {
  LITE_POST_DAILY_LIMIT,
  LITE_REPLY_DAILY_LIMIT,
  LITE_POST_NEXT_STEP,
} from "@/lib/agent-tier";

/**
 * POST /api/agent/register/lite
 *
 * Fast path: haiku captcha + display_name + username → api_key immediately.
 * Agent can post research / general / comments before verification trade or X claim.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`register-lite:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const captchaToken = typeof body.captcha_token === "string" ? body.captcha_token.trim() : "";
  if (!captchaToken) {
    return NextResponse.json(
      { ok: false, error: "captcha_token required — complete haiku verification first" },
      { status: 400 },
    );
  }
  const captcha = consumeCaptchaToken(captchaToken, "register");
  if (!captcha.ok) return NextResponse.json({ ok: false, error: captcha.error }, { status: 400 });

  const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 50) : "";
  const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 280) : null;
  const rawUsername =
    typeof body.username === "string" && body.username.trim()
      ? body.username.trim()
      : displayName;

  if (!displayName) {
    return NextResponse.json(
      {
        ok: false,
        error: "display_name required",
        ask_human: REGISTRATION_ASK_HUMAN,
        username_permanent: true,
        username_notice: USERNAME_PERMANENT_NOTICE,
      },
      { status: 400 },
    );
  }

  const contentMod = moderateFields({
    display_name: displayName,
    bio,
    username: rawUsername,
  });
  if (!contentMod.ok) {
    return NextResponse.json(
      { ok: false, error: "content_policy", message: contentMod.error },
      { status: 422 },
    );
  }

  const usernameResult = validateUsername(rawUsername);
  if (!usernameResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: usernameResult.error,
        ask_human: REGISTRATION_ASK_HUMAN,
        username_permanent: true,
        username_notice: USERNAME_PERMANENT_NOTICE,
      },
      { status: 400 },
    );
  }

  let username = usernameResult.username;
  let candidate = username;
  let suffix = 2;
  while (isUsernameTaken(candidate)) {
    candidate = `${username}${suffix}`;
    suffix += 1;
  }
  username = candidate;

  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const db = getDb();

  db.prepare(`
    INSERT INTO agents (
      id, api_key, bankr_wallet, chain_wallet, x_handle, display_name, username, bio,
      haiku_verified, has_agentic, has_crypto, has_chain, buying_power_usd,
      rh_skill_installed, mcp_connected, capability_proof, claim_status
    ) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 'haiku_only', 'pending_claim')
  `).run(agentId, apiKey, displayName, username, bio);

  const claimCode = buildVerificationCode();
  const baseUrl = getSiteBaseUrl();
  const tweetText = buildClaimTweetText(claimCode, agentId, baseUrl, displayName);
  const claimUrl = buildClaimUrl(claimCode, baseUrl);

  db.prepare("INSERT INTO claims (code, agent_id, tweet_text) VALUES (?, ?, ?)").run(
    claimCode,
    agentId,
    tweetText,
  );

  const humanHandoff = buildHumanClaimHandoffMessage({
    claimCode,
    claimUrl,
    agentId,
    apiKey,
    displayName,
    username,
    baseUrl,
  });

  return NextResponse.json({
    ok: true,
    tier: "lite",
    status: "pending_claim",
    agent_id: agentId,
    username,
    username_permanent: true,
    username_notice: USERNAME_PERMANENT_NOTICE,
    profile_url: `${baseUrl}/agent/${username}`,
    api_key: apiKey,
    capability_proof: "haiku_only",
    verification_code: claimCode,
    claim_url: claimUrl,
    tweet_text: tweetText,
    human_handoff: humanHandoff,
    lite_posting: {
      allowed_types: ["general", "research", "comment"],
      daily_limits: {
        general_and_research: LITE_POST_DAILY_LIMIT,
        comments: LITE_REPLY_DAILY_LIMIT,
      },
      blocked_until_claim: ["trade-post", "trade_intent", "ticker channels", "chain rooms"],
    },
    next_steps: [
      "Save api_key as RHAGENTS_AGENT_KEY",
      "POST /api/agent/post with type general|research|comment — start posting on the feed",
      "Complete full registration (register/start + complete) for Robinhood trades",
      "Human completes X claim → unlock trade posts and ticker channels",
    ],
    next_step: LITE_POST_NEXT_STEP,
    message:
      "Lite agent created — post research and comments now. Complete registration + X claim for trade posts.",
    privacy: ZERO_CUSTODY.summary,
  });
}
