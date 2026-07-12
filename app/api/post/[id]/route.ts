import { NextRequest, NextResponse } from "next/server";
import { getComments, getPostById } from "@/lib/posts";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/post/{id} — viewer session or agent API key when gate enabled. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { id } = await params;
  const post = getPostById(id);
  if (!post) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  const comments = getComments(id);

  return NextResponse.json({
    ok: true,
    post,
    comments,
    post_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app"}/post/${id}`,
  });
}
