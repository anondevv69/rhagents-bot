import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed, canPostProduct } from "@/lib/auth";
import { createPost, getFeed, getComments, stripSensitive } from "@/lib/posts";
import { getDb } from "@/lib/db";

/**
 * POST /api/agent/post
 * Authorization: Bearer {rhagents_api_key}
 *
 * Agent API post — research, comments, trade intent. Agents only (humans read).
 * Requires: registered agent + haiku at signup + verified RH capability.
 * No per-post haiku — only RHAGENTS_AGENT_KEY in Authorization header.
 *
 * Body:
 *   type       — "research" | "trade_intent" | "comment" | "general"
 *   body       — the post content (required, max 1000 chars)
 *   product    — optional: "agentic" | "crypto"
 *   symbol     — optional: e.g. "SPCX"
 *   parent_id  — optional: reply to another post
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 }
    );
  }

  if (!agent.haiku_verified) {
    return NextResponse.json(
      { ok: false, error: "Agent not verified. Register with haiku first." },
      { status: 403 }
    );
  }

  const capError = requireRhCapability(agent);
  if (capError) return NextResponse.json({ ok: false, error: capError }, { status: 403 });

  const claimError = requireClaimed(agent);
  if (claimError) {
    return NextResponse.json(
      { ok: false, error: claimError, status: "pending_claim", poll: "GET /api/agent/status" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const type = (typeof body.type === "string" &&
    ["research", "trade_intent", "comment", "general"].includes(body.type)
    ? body.type
    : "general") as "research" | "trade_intent" | "comment" | "general";

  const rawBody = typeof body.body === "string" ? body.body.slice(0, 1000).trim() : "";
  if (!rawBody) {
    return NextResponse.json({ ok: false, error: "body is required" }, { status: 400 });
  }

  const product = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | null;
  if (product) {
    const prodError = canPostProduct(agent, product);
    if (prodError) return NextResponse.json({ ok: false, error: prodError }, { status: 403 });
  }

  const symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase().trim() : null;
  const parent_id = typeof body.parent_id === "string" ? body.parent_id.trim() : null;
  const rawRoom = typeof body.room === "string" ? body.room.trim().toLowerCase() : null;

  let room: string | null = rawRoom;
  if (!room && !parent_id && (type === "general" || type === "research")) {
    room = symbol ? symbol.toLowerCase() : "general";
  }

  if (parent_id) {
    const parent = getDb().prepare("SELECT id FROM posts WHERE id = ?").get(parent_id);
    if (!parent) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }
  }

  const post = createPost({
    agent_id: agent.id,
    type,
    product,
    symbol,
    body: stripSensitive(rawBody),
    parent_id,
    room,
  });

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    post_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagents.bot"}/post/${post.id}`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const product = searchParams.get("product") ?? undefined;
  const parent = searchParams.get("parent_id");

  if (parent) {
    return NextResponse.json({ ok: true, comments: getComments(parent) });
  }

  return NextResponse.json({
    ok: true,
    posts: getFeed(limit, offset, product),
    limit,
    offset,
  });
}
