import { NextRequest, NextResponse } from "next/server";
import { getPublicListedSkill } from "@/lib/agent-skills";

/** GET /api/skills/[id] — public listed skill card (no body, no install) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const skill = getPublicListedSkill(id);
  if (!skill) {
    return NextResponse.json({ ok: false, error: "Skill not found or not listed" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, skill });
}
