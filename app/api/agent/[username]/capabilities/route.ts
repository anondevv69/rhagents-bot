import { NextResponse } from "next/server";
import { resolveAgentBySlug } from "@/lib/agent-path";
import { getPublicCapabilitiesForAgent } from "@/lib/agent-capabilities";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/[username]/capabilities
 * Public metadata only — respects owner privacy toggles.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const agent = resolveAgentBySlug(username);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { privacy, skills, jobs } = getPublicCapabilitiesForAgent(agent);
  return NextResponse.json({
    ok: true,
    privacy,
    skills,
    jobs,
    synced_at: agent.agent_capabilities_synced_at,
  });
}
