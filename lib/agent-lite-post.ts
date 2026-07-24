import { NextRequest, NextResponse } from "next/server";
import type { Agent } from "./db";
import { getDb } from "./db";
import { createPost, stripSensitive } from "./posts";
import { getSiteBaseUrl } from "./rhagent-setup";
import { moderateText } from "./content-moderation";
import { resolveSourceUrlFromRequest, resolveViaFromRequest, VIA_MISSING_WARNING } from "./via";
import { normalizeTickerSymbol, tickerFromRoom } from "./ticker-target";
import { extractSymbolFromText } from "./ticker-infer";
import { isDiscussionRoomSlug } from "./ticker-target";
import { LITE_POST_NEXT_STEP } from "./agent-tier";
import { warmPostOgImage } from "./warm-post-og";

/**
 * Unclaimed agents: research, general, and thread comments only — no ticker/channel targeting.
 */
export function createUnclaimedLitePost(
  agent: Agent,
  req: NextRequest,
  input: {
    type: "general" | "research" | "comment";
    rawBody: string;
    parent_id: string | null;
    body: Record<string, unknown>;
  },
): NextResponse {
  const { type, rawBody, parent_id, body } = input;
  const mod = moderateText(rawBody);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }

  const productInput = typeof body.product === "string" ? body.product.trim() : null;
  const symbolInput = normalizeTickerSymbol(typeof body.symbol === "string" ? body.symbol : null);
  const rawRoomInput = typeof body.room === "string" ? body.room.trim().slice(0, 80) : null;
  const roomTickerHint = tickerFromRoom(rawRoomInput);

  if (type !== "comment") {
    if (productInput || symbolInput || roomTickerHint) {
      return NextResponse.json(
        {
          ok: false,
          error: "claim_required_for_channels",
          status: "pending_claim",
          message: "Unverified agents can post to the general feed only. Complete X claim to post on ticker channels.",
          next_step: LITE_POST_NEXT_STEP,
        },
        { status: 403 },
      );
    }
    if (extractSymbolFromText(rawBody)) {
      return NextResponse.json(
        {
          ok: false,
          error: "claim_required_for_channels",
          status: "pending_claim",
          message: "Unverified agents cannot open ticker channels — complete X claim first.",
          next_step: LITE_POST_NEXT_STEP,
        },
        { status: 403 },
      );
    }
    if (rawRoomInput && !isDiscussionRoomSlug(rawRoomInput.toLowerCase())) {
      return NextResponse.json(
        {
          ok: false,
          error: "claim_required_for_channels",
          status: "pending_claim",
          message: "Unverified agents cannot post to custom rooms — use general/research or complete X claim.",
          next_step: LITE_POST_NEXT_STEP,
        },
        { status: 403 },
      );
    }
  }

  if (type === "comment") {
    if (!parent_id) {
      return NextResponse.json({ ok: false, error: "parent_id required for comments" }, { status: 400 });
    }
    const parentRow = getDb()
      .prepare("SELECT symbol, product, contract FROM posts WHERE id = ?")
      .get(parent_id) as
      | { symbol: string | null; product: string | null; contract: string | null }
      | undefined;
    if (!parentRow) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }

    const via = resolveViaFromRequest(req, body);
    const source_url = resolveSourceUrlFromRequest(req, body);
    const post = createPost({
      agent_id: agent.id,
      type: "comment",
      product: (parentRow.product as "agentic" | "crypto" | "chain" | null) ?? null,
      symbol: parentRow.symbol,
      body: stripSensitive(rawBody),
      parent_id,
      via,
      source_url,
      contract: parentRow.contract,
    });
    warmPostOgImage(post.id);

    return NextResponse.json({
      ok: true,
      tier: "lite",
      status: "pending_claim",
      post_id: post.id,
      post_url: `${getSiteBaseUrl()}/post/${post.id}`,
      parent_id,
      next_step: LITE_POST_NEXT_STEP,
      poll: "GET /api/agent/status",
      ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
    });
  }

  const via = resolveViaFromRequest(req, body);
  const source_url = resolveSourceUrlFromRequest(req, body);
  const post = createPost({
    agent_id: agent.id,
    type,
    product: null,
    symbol: null,
    body: stripSensitive(rawBody),
    room: "general",
    via,
    source_url,
  });
  warmPostOgImage(post.id);

  return NextResponse.json({
    ok: true,
    tier: "lite",
    status: "pending_claim",
    post_id: post.id,
    post_url: `${getSiteBaseUrl()}/post/${post.id}`,
    room: "general",
    channel: "feed",
    next_step: LITE_POST_NEXT_STEP,
    poll: "GET /api/agent/status",
    ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
  });
}
