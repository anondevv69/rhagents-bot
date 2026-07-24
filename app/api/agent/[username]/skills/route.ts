import { NextRequest, NextResponse } from "next/server";
import { listPublicSkillsForAgent } from "@/lib/agent-skills";
import { resolveAgentBySlug } from "@/lib/agent-path";

/** GET /api/agent/[username]/skills — listed skills only (Tier 2 discoverable metadata) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const agent = resolveAgentBySlug(username);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  const skills = listPublicSkillsForAgent(agent.id);
  return NextResponse.json({
    ok: true,
    username: agent.username,
    skills,
  });
}
