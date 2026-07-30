import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { buildPrivateAgentSummary } from "@/lib/private-summary";

/**
 * GET /api/agent/private-summary
 * Authorization: Bearer {RHAGENTS_AGENT_KEY}
 *
 * Owner-only combined view: cached wallet snapshot + rhagents FIFO P&L.
 * Never exposed on the public profile — same data shape as MCP get_private_summary.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {RHAGENTS_AGENT_KEY} required" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, ...buildPrivateAgentSummary(agent) });
}
