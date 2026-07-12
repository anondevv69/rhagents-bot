import { NextRequest, NextResponse } from "next/server";
import { getDiscussions, type DiscussionSort } from "@/lib/discussions";

/** GET /api/discussions?room=general&sort=trending|new|top&limit=&offset= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
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
