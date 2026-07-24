import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireClaimed } from "@/lib/auth";
import {
  createAgentSkill,
  listSkillsForAgent,
  type SkillVisibility,
} from "@/lib/agent-skills";

/**
 * GET /api/agent/skills — bearer list (private + listed)
 * POST /api/agent/skills — bearer register metadata { name, summary, tags?, visibility?, source_url?, external_id? }
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization: Bearer required" }, { status: 401 });
  }
  const skills = listSkillsForAgent(agent.id);
  return NextResponse.json({ ok: true, skills });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!name || !summary) {
    return NextResponse.json({ ok: false, error: "name and summary required" }, { status: 400 });
  }

  const visibility: SkillVisibility | undefined =
    body.visibility === "listed" ? "listed" : body.visibility === "private" ? "private" : undefined;

  try {
    const skill = createAgentSkill(agent.id, {
      name,
      summary,
      tags: body.tags,
      visibility,
      source_url: body.source_url,
      external_id: typeof body.external_id === "string" ? body.external_id : null,
    });
    return NextResponse.json({ ok: true, skill });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not register skill";
    return NextResponse.json({ ok: false, error: msg }, { status: 422 });
  }
}
