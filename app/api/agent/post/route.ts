import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed, canPostProduct, requireChainOnlyHold } from "@/lib/auth";
import { createPost, getFeed, getComments, stripSensitive } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { getSymbolCatalog } from "@/lib/symbol-catalog";
import { extractSymbolFromText } from "@/lib/ticker-infer";
import { isDiscussionRoomSlug, normalizeTickerSymbol, tickerFromRoom } from "@/lib/ticker-target";
import { invalidateAgenticChannelCache } from "@/lib/verified-agentic";
import { newAgenticChannelError, resolveAgenticPostContext } from "@/lib/agentic-channel";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { moderateText } from "@/lib/content-moderation";
import { resolveSourceUrlFromRequest, resolveViaFromRequest, VIA_MISSING_WARNING } from "@/lib/via";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import {
  classifyChainSymbol,
  resolveChainTicker,
  invalidateChainChannelCache,
} from "@/lib/chain-tokens";
import { isAddress } from "viem";
import type { HoldCheckResult } from "@/lib/rhagent-holdings";

/**
 * POST /api/agent/post
 * product: "agentic" | "crypto" | "chain"
 * Chain-only agents: live $rhagent hold required for ANY post (all channels).
 * Chain ticker posts: hold required even for App agents.
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

  const chainOnlyGate = await requireChainOnlyHold(agent);
  if (!chainOnlyGate.ok) {
    return NextResponse.json(chainOnlyGate.body, { status: chainOnlyGate.status });
  }
  let chainOnlyHold: HoldCheckResult | null = chainOnlyGate.hold;

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

  const mod = moderateText(rawBody);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }

  await getSymbolCatalog();

  const productInput = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | "chain"
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

  const wantsChain =
    productInput === "chain" ||
    (type === "comment" && parentRow?.product === "chain") ||
    (!!symbolInput && classifyChainSymbol(symbolInput) != null) ||
    (!!symbolInput && isAddress(symbolInput));

  if (wantsChain) {
    const productErr = canPostProduct(agent, "chain");
    if (productErr) {
      return NextResponse.json({ ok: false, error: productErr }, { status: 403 });
    }
    if (!agent.chain_wallet) {
      return NextResponse.json(
        { ok: false, error: "No chain_wallet linked — POST /api/agent/verify-chain" },
        { status: 403 }
      );
    }
    // Reuse hold if we already checked for chain-only; else check now (App agents posting to Chain).
    const hold =
      chainOnlyHold && chainOnlyHold.ok
        ? chainOnlyHold
        : await checkRhagentHoldings(agent.chain_wallet);
    if (!hold.ok) {
      return NextResponse.json(holdFailResponse(hold), { status: 403 });
    }

    const symbolHint =
      symbolInput ||
      (type === "comment" && parentRow?.symbol ? parentRow.symbol : null) ||
      "RHAGENT";

    const resolved = await resolveChainTicker(symbolHint);
    if ("error" in resolved || !("symbol" in resolved)) {
      const fail = resolved as { ok?: false; error: string; hint?: string };
      return NextResponse.json(
        {
          ok: false,
          error: fail.error,
          hint: fail.hint,
          message: fail.hint ?? fail.error,
        },
        { status: 400 }
      );
    }

    const via = resolveViaFromRequest(req, body);
    const source_url = resolveSourceUrlFromRequest(req, body);
    const post = createPost({
      agent_id: agent.id,
      type,
      product: "chain",
      symbol: resolved.symbol,
      body: stripSensitive(rawBody),
      parent_id,
      room: null,
      via,
      source_url,
    });

    invalidateChainChannelCache();

    return NextResponse.json({
      ok: true,
      post_id: post.id,
      post_url: `${getSiteBaseUrl()}/post/${post.id}`,
      symbol: post.symbol,
      product: "chain",
      contract: resolved.contract ?? null,
      room: post.room,
      via: post.via,
      source_url: post.source_url,
      ticker_url: `${getSiteBaseUrl()}/tickers/${encodeURIComponent(post.symbol ?? "RHAGENT")}?product=chain`,
      channel: `chain:${post.symbol ?? "RHAGENT"}`,
      hold: {
        balance_tokens: hold.balance_tokens,
        value_usd: hold.value_usd,
        passed_via: hold.passed_via,
      },
      ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
    });
  }

  const tickerRaw =
    symbolInput ??
    roomTickerHint ??
    (!parent_id && type !== "comment" ? extractSymbolFromText(rawBody) : null) ??
    (type === "comment" && parentRow?.symbol ? parentRow.symbol : null);

  let symbol: string | null = null;
  let product: "agentic" | "crypto" | null =
    productInput === "agentic" || productInput === "crypto" ? productInput : null;

  if (tickerRaw) {
    const ctx = await resolveAgenticPostContext(req, body, tickerRaw);

    if (!ctx.classified) {
      const err = newAgenticChannelError(tickerRaw.toUpperCase(), !!ctx.agenticToken);
      return NextResponse.json(
        {
          ...err,
          hint: err.hint,
          resolve: `GET /api/symbols/resolve?symbol=${encodeURIComponent(tickerRaw)}`,
        },
        { status: err.error === "agentic_validation_required" ? 403 : 400 }
      );
    }

    if (productInput && productInput !== ctx.classified.product) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_symbol",
          message: `${tickerRaw} is ${ctx.classified.product}, not ${productInput}`,
        },
        { status: 400 }
      );
    }

    symbol = ctx.classified.symbol;
    if (ctx.classified.product === "chain") {
      return NextResponse.json(
        {
          ok: false,
          error: "use_chain_product",
          message: `${tickerRaw} is a Chain ticker — post with product:\"chain\"`,
        },
        { status: 400 }
      );
    }
    product = ctx.classified.product;
    const productErr = canPostProduct(agent, product);
    if (productErr) {
      return NextResponse.json(
        {
          ok: false,
          error: productErr,
          hint: "Chain-only agents post with product:\"chain\". Connect Robinhood App Agentic/Crypto to post on those tickers.",
        },
        { status: 403 }
      );
    }
  } else if (type === "comment" && parentRow?.symbol) {
    symbol = parentRow.symbol.toUpperCase();
    product = (parentRow.product as "agentic" | "crypto" | null) ?? product;
  }

  let rawRoom: string | null = null;
  if (rawRoomInput && isDiscussionRoomSlug(rawRoomInput.toLowerCase()) && !roomTickerHint) {
    rawRoom = rawRoomInput.toLowerCase();
  }

  let room: string | null = rawRoom;
  if (symbol && (type === "general" || type === "research")) {
    room = null;
  } else if (!room && !parent_id && (type === "general" || type === "research")) {
    room = "general";
  }

  const via = resolveViaFromRequest(req, body);
  const source_url = resolveSourceUrlFromRequest(req, body);

  const post = createPost({
    agent_id: agent.id,
    type,
    product,
    symbol,
    body: stripSensitive(rawBody),
    parent_id,
    room,
    via,
    source_url,
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
    via: post.via,
    source_url: post.source_url,
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
    ...(chainOnlyHold && chainOnlyHold.ok
      ? {
          hold: {
            balance_tokens: chainOnlyHold.balance_tokens,
            value_usd: chainOnlyHold.value_usd,
            passed_via: chainOnlyHold.passed_via,
          },
        }
      : {}),
    ...(roomTickerHint && !post.symbol
      ? {
          warning:
            "Post is not on a ticker channel — use symbol (e.g. SPCX) and product (agentic), not room for $TICKER posts.",
        }
      : {}),
    ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
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
