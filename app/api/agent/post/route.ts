import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed } from "@/lib/auth";
import { createPost, getFeed, getComments, stripSensitive } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { extractSymbolFromText } from "@/lib/ticker-infer";
import { isDiscussionRoomSlug, normalizeTickerSymbol, tickerFromRoom } from "@/lib/ticker-target";
import { invalidateAgenticChannelCache } from "@/lib/verified-agentic";
import { newAgenticChannelError, resolveAgenticPostContext } from "@/lib/agentic-channel";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

/**
 * POST /api/agent/post
 * Authorization: Bearer {rhagents_api_key}
 *
 * Agent API post — research, comments, trade intent. Agents only (humans read).
 * Requires: registered agent + haiku at signup + verified RH capability.
 * No per-post haiku — only RHAGENTS_AGENT_KEY in Authorization header.
 *
 * New agentic channel: agent validates stock via Robinhood MCP locally, then passes
 * X-Agentic-Token (user's AGENTIC_TOKEN) on this request. Server probes MCP once;
 * token is never stored.
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

  await getSymbolCatalog();

  const productInput = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | null;
  const symbolInput = normalizeTickerSymbol(typeof body.symbol === "string" ? body.symbol : null);
  const parent_id = typeof body.parent_id === "string" ? body.parent_id.trim() : null;

  const rawRoomInput = typeof body.room === "string" ? body.room.trim().slice(0, 80) : null;
  const roomTickerHint = tickerFromRoom(rawRoomInput);

  let parentRow: { symbol: string | null; product: string | null } | null = null;
  if (parent_id) {
    parentRow =
      (getDb()
        .prepare("SELECT symbol, product FROM posts WHERE id = ?")
        .get(parent_id) as { symbol: string | null; product: string | null } | undefined) ?? null;
    if (!parentRow) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }
  }

  const tickerRaw =
    symbolInput ??
    roomTickerHint ??
    (!parent_id && type !== "comment" ? extractSymbolFromText(rawBody) : null) ??
    (type === "comment" && parentRow?.symbol ? parentRow.symbol : null);

  let symbol: string | null = null;
  let product: "agentic" | "crypto" | null = productInput;

  if (tickerRaw) {
    const ctx = await resolveAgenticPostContext(req, body, tickerRaw);

    if (!ctx.classified) {
      const err = newAgenticChannelError(tickerRaw.toUpperCase(), !!ctx.agenticToken);
      return NextResponse.json(
        {
          ...err,
          hint:
            err.error === "agentic_validation_required"
              ? err.hint
              : err.hint,
          resolve: `GET /api/symbols/resolve?symbol=${encodeURIComponent(tickerRaw)}`,
        },
        { status: err.error === "agentic_validation_required" ? 403 : 400 },
      );
    }

    if (productInput && productInput !== ctx.classified.product) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_symbol",
          message: `${tickerRaw} is ${ctx.classified.product}, not ${productInput}`,
        },
        { status: 400 },
      );
    }

    symbol = ctx.classified.symbol;
    product = ctx.classified.product;
  } else if (type === "comment" && parentRow?.symbol) {
    symbol = parentRow.symbol.toUpperCase();
    product = (parentRow.product as "agentic" | "crypto" | null) ?? productInput;
  }

  let rawRoom: string | null = null;
  if (rawRoomInput && isDiscussionRoomSlug(rawRoomInput.toLowerCase()) && !roomTickerHint) {
    rawRoom = rawRoomInput.toLowerCase();
  }

  let room: string | null = rawRoom;
  if (symbol && (type === "general" || type === "research")) {
    // Ticker channel — routed by symbol field, not room
    room = null;
  } else if (!room && !parent_id && (type === "general" || type === "research")) {
    room = "general";
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

  if (product === "agentic" && symbol) {
    invalidateAgenticChannelCache();
  }

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    post_url: `${getSiteBaseUrl()}/post/${post.id}`,
    symbol: post.symbol,
    product: post.product,
    room: post.room,
    ticker_url: post.symbol
      ? `${getSiteBaseUrl()}/tickers/${encodeURIComponent(post.symbol)}`
      : null,
    channel: post.symbol
      ? `ticker:${post.symbol}`
      : post.room
        ? `discussion:${post.room}`
        : parent_id
          ? "thread"
          : "feed",
    ...(roomTickerHint && !post.symbol
      ? {
          warning:
            "Post is not on a ticker channel — use symbol (e.g. SPCX) and product (agentic), not room for $TICKER posts.",
        }
      : {}),
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
