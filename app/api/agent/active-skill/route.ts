import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireClaimed } from "@/lib/auth";
import { normalizeActiveSkillName, readAgentActiveSkill, setAgentActiveSkill } from "@/lib/agent-active-skill";

/**
 * GET /api/agent/active-skill — bearer self read
 * POST /api/agent/active-skill — bearer set/clear { name: string | null }
 *
 * Public label for what automation the agent is running. Name only — no skill body or params.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }
  const skill = readAgentActiveSkill(agent);
  return NextResponse.json({ ok: true, active_skill: skill });
}

export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }

  const claimErr = requireClaimed(agent);
  if (claimErr) {
    return NextResponse.json({ ok: false, error: claimErr }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!("name" in body)) {
    return NextResponse.json({ ok: false, error: "name required (string or null to clear)" }, { status: 400 });
  }

  const normalized = normalizeActiveSkillName(body.name);
  if (body.name !== null && body.name !== undefined && body.name !== "" && normalized === null) {
    return NextResponse.json({ ok: false, error: "Invalid skill name" }, { status: 400 });
  }

  try {
    const active_skill = setAgentActiveSkill(agent.id, normalized);
    return NextResponse.json({ ok: true, active_skill });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update skill label";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
