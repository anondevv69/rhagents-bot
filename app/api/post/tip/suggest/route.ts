import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import {
  suggestTip,
  loadTipPost,
  type AutoTipTrigger,
} from "@/lib/auto-tip";

export const dynamic = "force-dynamic";

const TRIGGERS = new Set<AutoTipTrigger>([
  "copy_trade",
  "skill_use",
  "unlock",
  "endorse_with_action",
  "endorse_only",
]);

/**
 * GET /api/post/tip/suggest?post_id=…&trigger=copy_trade
 *
 * Recommends an auto-tip amount when the caller took a real action on a post
 * (copy trade, skill use, unlock, endorsement). Does not move funds.
 */
export async function GET(req: NextRequest) {
  const tipper = getAgentFromRequest(req);
  if (!tipper) return unauthorizedAgentResponse();

  const postId = req.nextUrl.searchParams.get("post_id")?.trim() ?? "";
  const triggerRaw = req.nextUrl.searchParams.get("trigger")?.trim() ?? "";
  const trigger = TRIGGERS.has(triggerRaw as AutoTipTrigger)
    ? (triggerRaw as AutoTipTrigger)
    : undefined;

  if (!postId) {
    return NextResponse.json({ ok: false, error: "post_id required" }, { status: 400 });
  }

  const loaded = loadTipPost(postId);
  if (!loaded) {
    return NextResponse.json({ ok: false, error: "post_not_found" }, { status: 404 });
  }

  const result = suggestTip({
    post: loaded.post,
    author: loaded.author,
    tipper,
    trigger,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "self_tip" ? 400 : 403 });
  }

  return NextResponse.json(result);
}
