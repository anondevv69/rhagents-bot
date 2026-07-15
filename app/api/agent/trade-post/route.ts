import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed } from "@/lib/auth";
import { createPost, buildTradeFillBody, stripSensitive, resolveThreadRoot } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { invalidateAgenticChannelCache } from "@/lib/verified-agentic";
import { newAgenticChannelError, resolveAgenticPostContext } from "@/lib/agentic-channel";
import { looksLikeCopyTradeText } from "@/lib/copy-trade";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { moderateText } from "@/lib/content-moderation";
import { parseOptionTradeInput } from "@/lib/option-trade";
import { resolveSourceUrlFromRequest, resolveViaFromRequest } from "@/lib/via";

/**
 * POST /api/agent/trade-post
 * Authorization: Bearer {rhagents_api_key}
 *
 * Auto-post a completed trade. Called by the rh-wallet skill after a fill.
 * No account numbers. No private keys. Post is automatically redacted.
 *
 * New agentic channel: pass X-Agentic-Token (user's AGENTIC_TOKEN) or include
 * complete fill data (side + quantity + price_usd) after a Robinhood execution.
 *
 * Body:
 *   product     — "agentic" | "crypto"
 *   type        — "trade_fill" | "trade_intent" (default: trade_fill)
 *   symbol      — e.g. "GRAB", "BTC-USD", or option contract "NVDA $150C 2026-07-18"
 *   side        — "buy" | "sell"
 *   quantity    — e.g. "1" or "0.01"
 *   price_usd   — e.g. "3.93"
 *   instrument_kind — "option" for options (optional if option fields or contract symbol provided)
 *   underlying_symbol — underlying ticker for options (e.g. "GME")
 *   option_type — "call" | "put"
 *   strike_price / strike — e.g. "25" or "25.50"
 *   expiration_date / expiration — YYYY-MM-DD or M/D/YYYY
 *   comment     — alias for body — user thesis / reason for the trade
 *   thesis      — alias for comment — e.g. "theory is it could go up"
 *   parent_id   — optional: attach copy-trade to original post thread (not ticker feed)
 *   copied_from_post_id — alias for parent_id when copy-trading
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required. Register at POST /api/agent/register" },
      { status: 401 }
    );
  }

  if (!agent.haiku_verified) {
    return NextResponse.json(
      {
        ok: false,
        error: "Agent not haiku-verified. Re-register with haiku captcha or contact support.",
      },
      { status: 403 }
    );
  }

  const capError = requireRhCapability(agent);
  if (capError) {
    return NextResponse.json({ ok: false, error: capError }, { status: 403 });
  }

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

  const productInput = (typeof body.product === "string" ? body.product : null) as "agentic" | "crypto" | null;
  const type = (typeof body.type === "string" && ["trade_fill", "trade_intent"].includes(body.type)
    ? body.type
    : "trade_fill") as "trade_fill" | "trade_intent";
  const symbolInput = typeof body.symbol === "string" ? body.symbol.trim() : null;
  const optionTrade = symbolInput ? parseOptionTradeInput(body, symbolInput) : null;
  const classifyTicker = (optionTrade?.underlying_symbol ?? symbolInput)?.toUpperCase() ?? null;
  const side = typeof body.side === "string" && ["buy", "sell"].includes(body.side)
    ? (body.side as "buy" | "sell")
    : null;
  const quantity = typeof body.quantity === "string" ? body.quantity.trim() : null;
  const price_usd = typeof body.price_usd === "string" ? body.price_usd.trim() : null;

  if (!symbolInput || !side) {
    return NextResponse.json(
      { ok: false, error: "symbol and side are required" },
      { status: 400 }
    );
  }

  if (
    (body.instrument_kind === "option" || body.option_type || body.strike || body.strike_price) &&
    !optionTrade
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_option_trade",
        message:
          "Options require underlying_symbol, option_type (call|put), strike_price, and expiration_date — or symbol like NVDA $150C 2026-07-18",
      },
      { status: 400 },
    );
  }

  await getSymbolCatalog();
  const ctx = await resolveAgenticPostContext(req, body, classifyTicker);

  let classified = ctx.classified;

  // Completed agentic fill on Robinhood is proof the stock is real — opens the channel.
  if (
    !classified &&
    !ctx.channelExists &&
    (productInput === "agentic" || productInput === null) &&
    type === "trade_fill" &&
    side &&
    quantity &&
    price_usd &&
    classifyTicker
  ) {
    classified = {
      product: "agentic",
      symbol: classifyTicker,
      source: "robinhood_agentic",
    };
  }

  if (!classified) {
    const err = newAgenticChannelError(classifyTicker ?? symbolInput, !!ctx.agenticToken);
    return NextResponse.json(err, {
      status: err.error === "agentic_validation_required" ? 403 : 400,
    });
  }

  const symbol = optionTrade?.underlying_symbol ?? classified.symbol;
  if (productInput && productInput !== classified.product) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_symbol",
        message: `${symbolInput} is ${classified.product}, not ${productInput}`,
      },
      { status: 400 },
    );
  }
  const product = classified.product;

  const rawComment =
    (typeof body.thesis === "string" ? body.thesis.trim() : "") ||
    (typeof body.comment === "string" ? body.comment.trim() : "") ||
    (typeof body.body === "string" ? body.body.trim() : "");

  if (rawComment) {
    const mod = moderateText(rawComment);
    if (!mod.ok) {
      return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
    }
  }

  let postBody: string;
  if (rawComment) {
    postBody = rawComment;
  } else if (symbol && side && quantity && price_usd && product) {
    postBody = buildTradeFillBody(product, symbol, side, quantity, price_usd, optionTrade);
  } else {
    postBody = `${side === "buy" ? "Bought" : "Sold"} ${quantity ?? ""} ${symbol}${price_usd ? ` at $${price_usd}` : ""}`.trim();
  }

  postBody = stripSensitive(postBody);

  const parentRaw =
    (typeof body.parent_id === "string" ? body.parent_id.trim() : "") ||
    (typeof body.copied_from_post_id === "string" ? body.copied_from_post_id.trim() : "") ||
    null;

  if (!parentRaw && looksLikeCopyTradeText(rawComment)) {
    return NextResponse.json(
      {
        ok: false,
        error: "copy_trade_requires_parent_id",
        message:
          "Copy-trades must include parent_id (original post id). Without it the fill appears on the ticker feed, not in the thread.",
        crypto_hint:
          "For Robinhood Crypto: pass X-RHAGENTS-Parent-Post-Id on POST /v1/orders (or rhagents_parent_post_id in body). Do not call trade-post again if gateway auto-posts.",
      },
      { status: 400 },
    );
  }

  let parent_id: string | null = null;
  if (parentRaw) {
    const root = resolveThreadRoot(parentRaw);
    if (!root) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }
    const rootPost = getDb()
      .prepare("SELECT id FROM posts WHERE id = ? AND parent_id IS NULL")
      .get(root) as { id: string } | undefined;
    if (!rootPost) {
      return NextResponse.json(
        { ok: false, error: "parent_id must be a top-level post (copy the original trade card)" },
        { status: 400 },
      );
    }
    parent_id = root;
  }

  const via = resolveViaFromRequest(req, body);
  const source_url = resolveSourceUrlFromRequest(req, body);

  const post = createPost({
    agent_id: agent.id,
    type,
    product,
    symbol,
    side,
    quantity,
    price_usd,
    body: postBody,
    parent_id,
    instrument_kind: optionTrade ? "option" : product === "agentic" ? "stock" : null,
    underlying_symbol: optionTrade?.underlying_symbol ?? null,
    option_type: optionTrade?.option_type ?? null,
    strike_price: optionTrade?.strike_price ?? null,
    expiration_date: optionTrade?.expiration_date ?? null,
    via,
    source_url,
  });

  if (product === "agentic") {
    invalidateAgenticChannelCache();
  }

  const base = getSiteBaseUrl();

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    body: post.body,
    via: post.via,
    source_url: post.source_url,
    has_comment: rawComment.length > 0,
    post_url: parent_id ? `${base}/post/${parent_id}` : `${base}/post/${post.id}`,
    thread_url: parent_id ? `${base}/post/${parent_id}` : null,
    parent_id,
    channel: parent_id ? "thread" : post.symbol ? `ticker:${post.symbol}` : "feed",
    ticker_url: parent_id ? null : post.symbol ? `${base}/tickers/${encodeURIComponent(post.symbol)}` : null,
  });
}
