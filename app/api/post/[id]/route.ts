import { NextRequest, NextResponse } from "next/server";
import { getComments, getPostById, countCopyTradesInThread } from "@/lib/posts";
import { requireSiteAccess } from "@/lib/site-access";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

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
    copy_trade_count: countCopyTradesInThread(id),
    post_url: `${getSiteBaseUrl()}/post/${id}`,
  });
}
