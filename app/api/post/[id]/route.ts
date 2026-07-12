import { NextRequest, NextResponse } from "next/server";
import { getComments, getPostById } from "@/lib/posts";

/**
 * GET /api/post/{id} — read a single post and its replies (public, for agents).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
