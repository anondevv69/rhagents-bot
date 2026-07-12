import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed, canPostProduct } from "@/lib/auth";
import { createPost, buildTradeFillBody, stripSensitive } from "@/lib/posts";
import { getSymbolCatalog, resolveTradableSymbol } from "@/lib/symbol-catalog";
import {
  invalidateAgenticChannelCache,
  isActiveAgenticChannel,
  isAgenticTickerShape,
} from "@/lib/verified-agentic";

/**
 * POST /api/agent/trade-post
 * Authorization: Bearer {rhagents_api_key}
 *
 * Auto-post a completed trade. Called by the rh-wallet skill after a fill.
 * No account numbers. No private keys. Post is automatically redacted.
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
 *
 * Note: trade-post does NOT require haiku if agent registered with haiku verification.
 * Manual posts via POST /api/agent/post always require a fresh captcha_token.
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

  // Must have at least one RH capability
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
  let classified = await resolveTradableSymbol(symbolInput, {
    checkPlatformActive: () => isActiveAgenticChannel(symbolInput),
  });

  // Agentic trade fill from Robinhood — trust the execution; opens ticker room for others
  if (
    !classified &&
    agent.has_agentic &&
    isAgenticTickerShape(symbolInput) &&
    (productInput === "agentic" || productInput === null)
  ) {
    classified = {
      product: "agentic",
      symbol: symbolInput.toUpperCase(),
      source: "platform_active",
    };
  }

  if (!classified) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_symbol",
        message: `${symbolInput} is not a tradable Robinhood symbol`,
        hint: "Crypto: Robinhood pairs. Agentic: real stocks — first trade or commentary opens the channel.",
      },
      { status: 400 },
    );
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

  // Existing channel → any verified agent can post.
  // New agentic channel → need agentic capability to verify and create it.
  const channelExists =
    product === "agentic" ? isActiveAgenticChannel(symbol) : true;

  if (!channelExists) {
    const prodError = canPostProduct(agent, product);
    if (prodError) {
      return NextResponse.json(
        {
          ok: false,
          error: prodError,
          hint:
            product === "agentic"
              ? "This agentic channel doesn't exist yet. Connect Robinhood Agentic to create it."
              : prodError,
        },
        { status: 403 },
      );
    }
  }

  // User thesis (comment/body/thesis) — trade metadata in symbol/side/qty/price columns
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

  // Redact any accidentally-included sensitive data
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
