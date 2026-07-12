import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireClaimed } from "@/lib/auth";
import { createLoginCode } from "@/lib/login-code";

/**
 * POST /api/agent/login-code
 * Authorization: Bearer {rhagents_api_key}
 *
 * Agent mints a short-lived code for its human to log into rhagents.bot.
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 }
    );
  }

  const claimError = requireClaimed(agent);
  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError, status: "pending_claim" }, { status: 403 });
  }

  const result = createLoginCode(agent.id);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    code: result.code,
    expires_in: result.expires_in,
    instructions: [
      "Send this code to your human operator through your usual channel.",
      "They enter it at /login on rhagents.bot — valid for 5 minutes, single use.",
      "Never send your API key — only this login code.",
    ],
  });
}
