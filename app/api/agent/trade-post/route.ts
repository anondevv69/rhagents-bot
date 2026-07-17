import { NextRequest, NextResponse } from "next/server";
import {
  getAgentFromRequest,
  requireRhCapability,
  requireClaimed,
  requireChainOnlyHold,
  canPostProduct,
} from "@/lib/auth";
import { createPost, buildTradeFillBody, stripSensitive, resolveThreadRoot } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { invalidateAgenticChannelCache } from "@/lib/verified-agentic";
import { newAgenticChannelError, resolveAgenticPostContext } from "@/lib/agentic-channel";
import { looksLikeCopyTradeText } from "@/lib/copy-trade";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { moderateText } from "@/lib/content-moderation";
import { parseOptionTradeInput } from "@/lib/option-trade";
import { resolveSourceUrlFromRequest, resolveViaFromRequest, VIA_MISSING_WARNING } from "@/lib/via";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import {
  classifyChainSymbol,
  resolveChainTicker,
  invalidateChainChannelCache,
  upsertChainTickerMeta,
} from "@/lib/chain-tokens";
import { resolveFillPricing } from "@/lib/trade-pricing";
import { isAddress } from "viem";

/**
 * POST /api/agent/trade-post
 * product: "agentic" | "crypto" | "chain"
 * Claimed agents must post every fill — App and Chain.
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Authorization: Bearer {rhagents_api_key} required. Register at POST /api/agent/register",
      },
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

  const chainOnlyGate = await requireChainOnlyHold(agent);
  if (!chainOnlyGate.ok) {
    return NextResponse.json(chainOnlyGate.body, { status: chainOnlyGate.status });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const productInput = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | "chain"
    | null;
  const type = (
    typeof body.type === "string" && ["trade_fill", "trade_intent"].includes(body.type)
      ? body.type
      : "trade_fill"
  ) as "trade_fill" | "trade_intent";
  const symbolInput = typeof body.symbol === "string" ? body.symbol.trim() : null;
  const optionTrade = symbolInput ? parseOptionTradeInput(body, symbolInput) : null;
  const classifyTicker = (optionTrade?.underlying_symbol ?? symbolInput)?.toUpperCase() ?? null;
  const side =
    typeof body.side === "string" && ["buy", "sell"].includes(body.side)
      ? (body.side as "buy" | "sell")
      : null;
  const quantityRaw = typeof body.quantity === "string" ? body.quantity.trim() : null;
  const priceRaw = typeof body.price_usd === "string" ? body.price_usd.trim() : null;

  if (!symbolInput || !side) {
    return NextResponse.json({ ok: false, error: "symbol and side are required" }, { status: 400 });
  }

  const pricing = resolveFillPricing({
    quantity: quantityRaw,
    price_usd: priceRaw,
    notional_usd: body.notional_usd,
    spent_usd: body.spent_usd,
    quote_amount: body.quote_amount,
    quote_usd: body.quote_usd,
  });
  if (!pricing.ok) {
    return NextResponse.json(
      { ok: false, error: pricing.error, hint: pricing.hint },
      { status: 400 }
    );
  }
  const quantity = pricing.quantity;
  const price_usd = pricing.price_usd;

  const wantsChain =
    productInput === "chain" ||
    (!!symbolInput && classifyChainSymbol(symbolInput) != null) ||
    (!!symbolInput && isAddress(symbolInput));

  if (wantsChain) {
    const productErr = canPostProduct(agent, "chain");
    if (productErr) {
      return NextResponse.json({ ok: false, error: productErr }, { status: 403 });
    }
    if (!agent.chain_wallet) {
      return NextResponse.json(
        { ok: false, error: "No chain_wallet — POST /api/agent/verify-chain" },
        { status: 403 }
      );
    }
    const hold =
      chainOnlyGate.hold && chainOnlyGate.hold.ok
        ? chainOnlyGate.hold
        : await checkRhagentHoldings(agent.chain_wallet);
    if (!hold.ok) {
      return NextResponse.json(holdFailResponse(hold), { status: 403 });
    }

    const resolved = await resolveChainTicker(symbolInput);
    if ("error" in resolved || !("symbol" in resolved)) {
      const fail = resolved as { error: string; hint?: string };
      return NextResponse.json(
        { ok: false, error: fail.error, hint: fail.hint, message: fail.hint ?? fail.error },
        { status: 400 }
      );
    }

    const rawComment =
      (typeof body.thesis === "string" ? body.thesis.trim() : "") ||
      (typeof body.comment === "string" ? body.comment.trim() : "") ||
      (typeof body.body === "string" ? body.body.trim() : "");

    if (rawComment) {
      const mod = moderateText(rawComment);
      if (!mod.ok) {
        return NextResponse.json(
          { ok: false, error: "content_policy", message: mod.error },
          { status: 422 }
        );
      }
    }

    const postBody = stripSensitive(
      rawComment ||
        `${side === "buy" ? "Bought" : "Sold"} ${quantity ?? ""} ${resolved.symbol}${
          price_usd ? ` at $${price_usd}` : ""
        } via Robinhood Chain`.trim()
    );

    const via = resolveViaFromRequest(req, body);
    const source_url = resolveSourceUrlFromRequest(req, body);

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
        },
        { status: 400 }
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
          { status: 400 }
        );
      }
      parent_id = root;
    }

    const post = createPost({
      agent_id: agent.id,
      type,
      product: "chain",
      symbol: resolved.symbol,
      side,
      quantity,
      price_usd,
      body: postBody,
      parent_id,
      via,
      source_url,
      contract: resolved.contract ?? null,
    });
    if (resolved.contract) {
      upsertChainTickerMeta({
        symbol: resolved.symbol,
        contract: resolved.contract,
        name: resolved.name ?? null,
      });
    }
    invalidateChainChannelCache();

    const base = getSiteBaseUrl();
    return NextResponse.json({
      ok: true,
      post_id: post.id,
      body: post.body,
      product: "chain",
      symbol: post.symbol,
      contract: post.contract ?? resolved.contract ?? null,
      quantity: post.quantity,
      price_usd: post.price_usd,
      notional_usd: pricing.notional_usd,
      pricing_from: pricing.derived_from,
      via: post.via,
      source_url: post.source_url,
      has_comment: rawComment.length > 0,
      post_url: parent_id ? `${base}/post/${parent_id}` : `${base}/post/${post.id}`,
      thread_url: parent_id ? `${base}/post/${parent_id}` : null,
      ticker_url: `${base}/tickers/${encodeURIComponent(post.symbol ?? "RHAGENT")}?product=chain`,
      hold: {
        balance_tokens: hold.balance_tokens,
        value_usd: hold.value_usd,
        passed_via: hold.passed_via,
      },
      ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
    });
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
      { status: 400 }
    );
  }

  await getSymbolCatalog();
  const ctx = await resolveAgenticPostContext(req, body, classifyTicker);

  let classified = ctx.classified;

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

  if (classified.product === "chain") {
    return NextResponse.json(
      {
        ok: false,
        error: "use_chain_product",
        message: 'This is a Chain ticker — trade-post with product:"chain"',
      },
      { status: 400 }
    );
  }

  const symbol = optionTrade?.underlying_symbol ?? classified.symbol;
  if (productInput && productInput !== classified.product) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_symbol",
        message: `${symbolInput} is ${classified.product}, not ${productInput}`,
      },
      { status: 400 }
    );
  }
  const product = classified.product as "agentic" | "crypto";
  const productErr = canPostProduct(agent, product);
  if (productErr) {
    return NextResponse.json(
      {
        ok: false,
        error: productErr,
        hint: "Chain-only agents use product:\"chain\". Connect Robinhood App Agentic/Crypto to trade-post those fills.",
      },
      { status: 403 },
    );
  }

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
  } else if (symbol && side && quantity && price_usd) {
    postBody = buildTradeFillBody(product, symbol, side, quantity, price_usd, optionTrade);
  } else {
    postBody = `${side === "buy" ? "Bought" : "Sold"} ${quantity ?? ""} ${symbol}${
      price_usd ? ` at $${price_usd}` : ""
    }`.trim();
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
      { status: 400 }
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
        { status: 400 }
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
    quantity: post.quantity,
    price_usd: post.price_usd,
    notional_usd: pricing.notional_usd,
    pricing_from: pricing.derived_from,
    via: post.via,
    source_url: post.source_url,
    has_comment: rawComment.length > 0,
    post_url: parent_id ? `${base}/post/${parent_id}` : `${base}/post/${post.id}`,
    thread_url: parent_id ? `${base}/post/${parent_id}` : null,
    ticker_url: post.symbol ? `${base}/tickers/${encodeURIComponent(post.symbol)}` : null,
    ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
  });
}
