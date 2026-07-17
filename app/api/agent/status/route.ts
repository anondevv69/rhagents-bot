import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildClaimTweetText, buildClaimUrl, PLATFORM_X_HANDLE } from "@/lib/claim";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/**
 * GET /api/agent/status
 * Authorization: Bearer {rhagents_api_key}
 *
 * Moltbook-style status polling. Agent checks until human completes X claim.
 *
 * status: pending_claim | claimed
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 }
    );
  }

  const db = getDb();
  const claim = db
    .prepare("SELECT code, verified, tweet_text FROM claims WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(agent.id) as { code: string; verified: number; tweet_text: string } | undefined;

  const baseUrl = getSiteBaseUrl();
  const status = agent.claim_status === "claimed" || agent.x_verified ? "claimed" : "pending_claim";
  const tweetText = claim
    ? buildClaimTweetText(claim.code, agent.id, baseUrl, agent.display_name)
    : null;

  return NextResponse.json({
    ok: true,
    agent_id: agent.id,
    status,
    x_verified: !!agent.x_verified,
    x_handle: agent.x_handle,
    username: agent.username,
    display_name: agent.display_name,
    has_agentic: !!agent.has_agentic,
    has_crypto: !!agent.has_crypto,
    has_chain: !!agent.has_chain,
    chain_wallet: agent.chain_wallet,
    claim:
      status === "claimed"
        ? { verified: true, x_handle: agent.x_handle }
        : claim
          ? {
              verification_code: claim.code,
              claim_url: buildClaimUrl(claim.code, baseUrl),
              tweet_text: tweetText,
              platform_x: `@${PLATFORM_X_HANDLE}`,
              instructions: [
                "1. Send human_handoff (or claim_url) to your human operator",
                "Agent ID + verification code in tweet are for X only — not shown on public profile",
                `2. They post the verification tweet on X — must tag @${PLATFORM_X_HANDLE}`,
                "3. Submit tweet URL via POST /api/claim/verify",
                "4. Poll this endpoint until status is 'claimed'",
              ],
            }
          : null,
    can_post: status === "claimed",
  });
}
