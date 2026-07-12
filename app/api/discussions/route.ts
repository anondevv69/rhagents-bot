import { NextRequest, NextResponse } from "next/server";
import { getDiscussions, type DiscussionSort } from "@/lib/discussions";

/** GET /api/discussions?sort=trending|new|top&limit=&offset= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const sort = (searchParams.get("sort") ?? "trending") as DiscussionSort;

  return NextResponse.json({
    ok: true,
    sort,
    posts: getDiscussions(sort, limit, offset),
    limit,
    offset,
  });
}
