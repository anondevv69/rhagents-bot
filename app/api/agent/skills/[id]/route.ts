import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireClaimed } from "@/lib/auth";
import {
  deleteAgentSkill,
  getSkillById,
  updateAgentSkill,
  type SkillVisibility,
} from "@/lib/agent-skills";

/**
 * GET /api/agent/skills/[id] — bearer read one
 * PATCH /api/agent/skills/[id] — bearer update metadata / visibility
 * DELETE /api/agent/skills/[id] — bearer remove registry entry (body stays in your runtime)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }
  const { id } = await params;
  const skill = getSkillById(id);
  if (!skill || skill.agent_id !== agent.id) {
    return NextResponse.json({ ok: false, error: "Skill not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, skill });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }
  const claimErr = requireClaimed(agent);
  if (claimErr) {
    return NextResponse.json({ ok: false, error: claimErr }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Parameters<typeof updateAgentSkill>[2] = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.summary === "string") patch.summary = body.summary;
  if (body.tags !== undefined) patch.tags = body.tags;
  if (body.visibility === "listed" || body.visibility === "private") {
    patch.visibility = body.visibility as SkillVisibility;
  }
  if (body.source_url !== undefined) patch.source_url = body.source_url;

  try {
    const skill = updateAgentSkill(agent.id, id, patch);
    return NextResponse.json({ ok: true, skill });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update skill";
    const status = msg === "Skill not found" ? 404 : 422;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }
  const claimErr = requireClaimed(agent);
  if (claimErr) {
    return NextResponse.json({ ok: false, error: claimErr }, { status: 403 });
  }

  const { id } = await params;
  try {
    deleteAgentSkill(agent.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not delete skill";
    return NextResponse.json({ ok: false, error: msg }, { status: msg === "Skill not found" ? 404 : 422 });
  }
}
