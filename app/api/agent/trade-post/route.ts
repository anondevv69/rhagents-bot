import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed } from "@/lib/auth";
import { createPost, buildTradeFillBody, stripSensitive } from "@/lib/posts";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { invalidateAgenticChannelCache } from "@/lib/verified-agentic";
import { newAgenticChannelError, resolveAgenticPostContext } from "@/lib/agentic-channel";

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
 *   symbol      — e.g. "GRAB", "BTC-USD"
 *   side        — "buy" | "sell"
 *   quantity    — e.g. "1" or "0.01"
 *   price_usd   — e.g. "3.93"
 *   comment     — alias for body — user thesis / reason for the trade
 *   thesis      — alias for comment — e.g. "theory is it could go up"
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
  const symbolInput = typeof body.symbol === "string" ? body.symbol.toUpperCase().trim() : null;
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

  await getSymbolCatalog();
  const ctx = await resolveAgenticPostContext(req, body, symbolInput);

  let classified = ctx.classified;

  // Completed agentic fill on Robinhood is proof the stock is real — opens the channel.
  if (
    !classified &&
    !ctx.channelExists &&
    (productInput === "agentic" || productInput === null) &&
    type === "trade_fill" &&
    side &&
    quantity &&
    price_usd
  ) {
    classified = {
      product: "agentic",
      symbol: symbolInput.toUpperCase(),
      source: "robinhood_agentic",
    };
  }

  if (!classified) {
    const err = newAgenticChannelError(symbolInput, !!ctx.agenticToken);
    return NextResponse.json(err, {
      status: err.error === "agentic_validation_required" ? 403 : 400,
    });
  }

  const symbol = classified.symbol;
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

  let postBody: string;
  if (rawComment) {
    postBody = rawComment;
  } else if (symbol && side && quantity && price_usd && product) {
    postBody = buildTradeFillBody(product, symbol, side, quantity, price_usd);
  } else {
    postBody = `${side === "buy" ? "Bought" : "Sold"} ${quantity ?? ""} ${symbol}${price_usd ? ` at $${price_usd}` : ""}`.trim();
  }

  postBody = stripSensitive(postBody);

  const post = createPost({
    agent_id: agent.id,
    type,
    product,
    symbol,
    side,
    quantity,
    price_usd,
    body: postBody,
  });

  if (product === "agentic") {
    invalidateAgenticChannelCache();
  }

  return NextResponse.json({
    ok: true,
    post_id: post.id,
    body: post.body,
    has_comment: rawComment.length > 0,
    post_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app"}/post/${post.id}`,
  });
}
