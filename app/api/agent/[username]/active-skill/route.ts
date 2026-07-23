import { NextRequest, NextResponse } from "next/server";
import { getActiveSkillByUsername } from "@/lib/agent-active-skill";
import { resolveAgentBySlug } from "@/lib/agent-path";

/** GET /api/agent/[username]/active-skill — public read of running automation label */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const agent = resolveAgentBySlug(username);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  const active_skill = getActiveSkillByUsername(agent.username ?? username);
  return NextResponse.json({
    ok: true,
    username: agent.username,
    active_skill: active_skill ?? { name: null, updated_at: null },
  });
}
