import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { requireOwnedAgentForLink } from "@/lib/agent-link";
import { createXOwnerLink } from "@/lib/owner-link";
import { PLATFORM_X_HANDLE } from "@/lib/claim";

/**
 * POST /api/agent/link-x
 * Body: { agent_id }
 *
 * Mint a one-time RHX-… code + tweet text so a wallet (or TG) owner can attach X.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";

  const guard = await requireOwnedAgentForLink(req, agentId, {
    rateLimitScope: "link-x",
    unauthMessage: "Log in to generate an X link code.",
    ownershipMessage: "Only the verified owner can link X.",
  });
  if (!guard.ok) return guard.response;

  const { agent } = guard;

  if (agent.owner_x_handle && agent.x_verified) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_linked",
        message: `X is already linked as @${agent.owner_x_handle.replace(/^@/, "")}.`,
      },
      { status: 409 },
    );
  }

  const link = createXOwnerLink(agentId);
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(link.tweet_text)}`;

  return NextResponse.json({
    ok: true,
    code: link.code,
    tweet_text: link.tweet_text,
    tweet_intent_url: intent,
    expires_at: link.expires_at,
    platform_x: `@${PLATFORM_X_HANDLE}`,
    instructions: [
      `1. Post this tweet (must tag @${PLATFORM_X_HANDLE} and include ${link.code})`,
      "2. Copy the tweet URL",
      "3. Submit it via POST /api/agent/link-x/verify { agent_id, code, tweet_url }",
    ],
  });
}
