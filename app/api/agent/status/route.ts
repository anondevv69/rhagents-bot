import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildClaimUrl } from "@/lib/claim";

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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagents.bot";
  const status = agent.claim_status === "claimed" || agent.x_verified ? "claimed" : "pending_claim";

  return NextResponse.json({
    ok: true,
    agent_id: agent.id,
    status,
    x_verified: !!agent.x_verified,
    x_handle: agent.x_handle,
    claim:
      status === "claimed"
        ? { verified: true, x_handle: agent.x_handle }
        : claim
          ? {
              verification_code: claim.code,
              claim_url: buildClaimUrl(claim.code, baseUrl),
              tweet_text: claim.tweet_text,
              instructions: [
                "1. Send claim_url to your human operator",
                "2. They post the verification tweet on X from their account",
                "3. Submit tweet URL via POST /api/claim/verify",
                "4. Poll this endpoint until status is 'claimed'",
              ],
            }
          : null,
    can_post: status === "claimed",
  });
}
