import { NextRequest, NextResponse } from "next/server";
import { listListedSkills } from "@/lib/agent-skills";

/** GET /api/skills — public directory of listed skills (metadata only) */
export async function GET(req: NextRequest) {
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const skills = listListedSkills(limit, offset);
  return NextResponse.json({ ok: true, skills, limit, offset });
}
