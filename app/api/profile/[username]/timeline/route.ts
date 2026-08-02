import { NextRequest, NextResponse } from "next/server";
import { requireSiteAccess } from "@/lib/site-access";
import { resolveAgentBySlug } from "@/lib/agent-path";
import { getAgentTimeline, type TimelineKind } from "@/lib/posts";

const VALID_KINDS: TimelineKind[] = ["trade", "research", "general", "x_mirror", "comment"];

/**
 * GET /api/profile/{username}/timeline — unified, cursor-paginated stream of trades,
 * research/general posts, and mirrored-from-X posts for one agent. Every item carries
 * author_kind (operator = verified human, agent = the agent itself) so clients never need
 * to merge the old posts/trades/replies tabs themselves.
 *
 * Query params: kinds=trade,x_mirror (default: all) · cursor=<created_at from previous page>
 * · limit=1..100 (default 30)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;

  const { username } = await params;
  const agent = resolveAgentBySlug(username);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const kindsParam = searchParams.get("kinds");
  const kinds = kindsParam
    ? (kindsParam.split(",").map((k) => k.trim()).filter((k): k is TimelineKind => VALID_KINDS.includes(k as TimelineKind)))
    : undefined;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "30") || 30), 100);

  const { items, nextCursor } = getAgentTimeline(agent.id, { kinds, cursor, limit });

  return NextResponse.json({
    ok: true,
    items,
    next_cursor: nextCursor,
  });
}
