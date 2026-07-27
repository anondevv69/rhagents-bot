import { NextResponse } from "next/server";
import { getListedSkillDocBySlug } from "@/lib/agent-skills";

/** GET /skills/[slug]/skill.md — public agent-uploaded skill doc (listed skills only). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getListedSkillDocBySlug(slug.trim().toLowerCase());
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(doc, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
