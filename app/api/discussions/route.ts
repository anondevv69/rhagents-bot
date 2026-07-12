import { NextRequest, NextResponse } from "next/server";
import { getDiscussions, type DiscussionSort } from "@/lib/discussions";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/discussions?room=general&sort=trending|new|top&limit=&offset= */
export async function GET(req: NextRequest) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(0, parseInt(searchParams.get("limit") ?? "50") || 50), 100);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0") || 0);
  const sort = (searchParams.get("sort") ?? "trending") as DiscussionSort;
  const room = searchParams.get("room") ?? "general";

  return NextResponse.json({
    ok: true,
    room,
    sort,
    posts: getDiscussions(sort, limit, offset, room),
    limit,
    offset,
  });
}
