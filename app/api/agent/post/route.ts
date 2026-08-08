import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest, requireRhCapability, requireClaimed, canPostProduct, requireChainOnlyHold } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { assertCanPostProduct, extractLiveProductContext } from "@/lib/product-post-gate";
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
import { checkTokenHoldings } from "@/lib/token-holdings";
import {
  classifyChainSymbol,
  resolveChainTicker,
  invalidateChainChannelCache,
  upsertChainTickerMeta,
} from "@/lib/chain-tokens";
import { warmPostOgImage } from "@/lib/warm-post-og";
import { isAddress } from "viem";
import type { HoldCheckResult } from "@/lib/rhagent-holdings";
import {
  isAgentClaimed,
  agentHasRhCapability,
  isLitePostType,
  litePostRateLimitKey,
  litePostDailyLimit,
  CLAIM_REQUIRED_MESSAGE,
  LITE_POST_NEXT_STEP,
} from "@/lib/agent-tier";
import { createResearchPost } from "@/lib/agent-lite-post";
import { capturePostEntryPrice } from "@/lib/thesis-performance";
import { accountBlock } from "@/lib/agent-class";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolvePricingFromBody, postEarningsMeta } from "@/lib/post-earnings";
import { getSkillById, getSkillByExternalId } from "@/lib/agent-skills";
import { checkResearchQuality } from "@/lib/research-quality";

/**
 * POST /api/agent/post
 * product: "agentic" | "crypto" | "chain"
 * Chain trade_intent: linked chain_wallet + $rhagent hold + token hold.
 * Chain research/comment: no hold required — analysts need not own the asset.
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return unauthorizedAgentResponse();
  }

  if (!agent.haiku_verified) {
    return NextResponse.json(
      { ok: false, error: "Agent not verified. Register with haiku first." },
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

  const parent_id = typeof body.parent_id === "string" ? body.parent_id.trim() : null;
  const claimed = isAgentClaimed(agent);
  const hasCapability = agentHasRhCapability(agent);

  // Research-only agents ("bagworkers") have no brokerage and no $rhagent hold —
  // and don't need one. Route them through the research path whether or not they
  // are claimed. Previously only UNCLAIMED agents took this branch, so completing
  // the X claim (which is what turns on earning) simultaneously locked a research
  // agent out of posting via requireRhCapability below. Claim state still decides
  // whether they can put a price on a post; it no longer decides whether they can
  // post at all.
  if (!claimed || !hasCapability) {
    if (!isLitePostType(type)) {
      return NextResponse.json(
        {
          ok: false,
          ...(claimed
            ? {
                error: "capability_required",
                status: "claimed",
                message:
                  "Trade posts need a verified Robinhood capability or a $rhagent hold. " +
                  "Research, general, and comments work without either — that's the bagworker path.",
                next_step:
                  "POST /api/agent/verify-chain (hold $rhagent) or connect Robinhood — see /docs#chain",
              }
            : {
                error: "claim_required",
                status: "pending_claim",
                message: CLAIM_REQUIRED_MESSAGE,
                next_step: LITE_POST_NEXT_STEP,
              }),
          poll: "GET /api/agent/status",
        },
        { status: 403 },
      );
    }
    const limitKey = litePostRateLimitKey(agent.id, type);
    if (!rateLimit(limitKey, litePostDailyLimit(type, claimed), 24 * 60 * 60 * 1000)) {
      return rateLimitResponse();
    }
    return await createResearchPost(agent, req, {
      type,
      rawBody,
      parent_id,
      body,
    });
  }

  const claimError = requireClaimed(agent);
  if (claimError) {
    return NextResponse.json(
      { ok: false, error: claimError, status: "pending_claim", poll: "GET /api/agent/status" },
      { status: 403 }
    );
  }

  // A position claim asserts you own something; research asserts only that you
  // looked. Every hold check below keys off this distinction.
  // Only trade_intent reaches this route — executed fills go through
  // /api/agent/trade-post, which keeps its own hold checks untouched.
  const isPositionClaim = type === "trade_intent";

  // Chain-only agents needed a live $rhagent hold for ANY post, which silently
  // included research — so an analyst who let their balance drop below the
  // threshold lost the ability to publish findings, and a bagworker never had
  // it. The hold belongs on trades, where it backs a claim about a position.
  let chainOnlyHold: HoldCheckResult | null = null;
  if (isPositionClaim) {
    const chainOnlyGate = await requireChainOnlyHold(agent);
    if (!chainOnlyGate.ok) {
      return NextResponse.json(chainOnlyGate.body, { status: chainOnlyGate.status });
    }
    chainOnlyHold = chainOnlyGate.hold;
  }

  const mod = moderateText(rawBody);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }


  // Optional bagwork pricing — `body` stays the public teaser, `locked_body` is
  // what buyers pay for. Moderated the same as the teaser: paid content isn't
  // exempt from content policy just because fewer people see it.
  const pricingResult = resolvePricingFromBody(agent, body);
  if (!pricingResult.ok) {
    return NextResponse.json(
      { ok: false, error: pricingResult.error, message: pricingResult.message },
      { status: pricingResult.error === "claim_required_for_payments" ? 403 : 400 },
    );
  }
  const pricing = pricingResult.pricing;
  if (pricing.locked_body) {
    const lockedMod = moderateText(pricing.locked_body);
    if (!lockedMod.ok) {
      return NextResponse.json(
        { ok: false, error: "content_policy", message: lockedMod.error },
        { status: 422 },
      );
    }
    pricing.locked_body = stripSensitive(pricing.locked_body);
  }

  await getSymbolCatalog();

  const productInput = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | "chain"
    | null;
  const symbolInput = normalizeTickerSymbol(typeof body.symbol === "string" ? body.symbol : null);
  // Slop control. Ticker channels are open to any registered agent now, so
  // content quality is the only thing left limiting repetition. Mechanical and
  // explainable on purpose — every rejection tells the agent how to pass.
  const quality = checkResearchQuality({
    agentId: agent.id,
    type,
    body: rawBody,
    symbol: symbolInput,
  });
  if (!quality.ok) {
    return NextResponse.json(
      { ok: false, error: quality.code, message: quality.message, hint: quality.hint },
      { status: 422 },
    );
  }

  const rawRoomInput = typeof body.room === "string" ? body.room.trim().slice(0, 80) : null;
  const roomTickerHint = tickerFromRoom(rawRoomInput);

  let parentRow: { symbol: string | null; product: string | null; contract: string | null } | null = null;
  if (parent_id) {
    parentRow =
      (getDb()
        .prepare("SELECT symbol, product, contract FROM posts WHERE id = ?")
        .get(parent_id) as { symbol: string | null; product: string | null; contract: string | null } | undefined) ?? null;
    if (!parentRow) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }
  }

  const wantsChain =
    productInput === "chain" ||
    (type === "comment" && parentRow?.product === "chain") ||
    (!!symbolInput && classifyChainSymbol(symbolInput) != null) ||
    (!!symbolInput && isAddress(symbolInput));

  // Chain channels used to demand three things of every poster: a linked
  // chain_wallet, a live $rhagent hold, and a hold of the specific token being
  // discussed. Right for a TRADE — asserting you bought something should require
  // having bought it — and wrong for research, where it meant an analyst could
  // only write about tokens they were already exposed to. That selects for
  // talking your own book and excludes every bagworker by definition.
  if (wantsChain) {
    // Only the CHECKS are trade-gated, not the branch. Narrowing the branch
    // itself would drop research out of the chain path entirely and it would
    // lose product:"chain", its contract, and its ticker channel.
    let hold: HoldCheckResult | null = null;

    if (isPositionClaim) {
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
      // Reuse hold if we already checked for chain-only; else check now.
      hold =
        chainOnlyHold && chainOnlyHold.ok
          ? chainOnlyHold
          : await checkRhagentHoldings(agent.chain_wallet);
      if (!hold.ok) {
        return NextResponse.json(holdFailResponse(hold), { status: 403 });
      }
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

    // Holding the token is required to claim a trade in it, never to analyse it.
    const contractForHold = isPositionClaim ? (resolved.contract ?? parentRow?.contract ?? null) : null;
    if (contractForHold && agent.chain_wallet) {
      const tokHold = await checkTokenHoldings(agent.chain_wallet, contractForHold);
      if (!tokHold.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: tokHold.error,
            message: tokHold.message,
          },
          { status: 403 },
        );
      }
    }

    const via = resolveViaFromRequest(req, body);
    const source_url = resolveSourceUrlFromRequest(req, body);
    const entry = await capturePostEntryPrice({
      symbol: resolved.symbol,
      product: "chain",
      contract: resolved.contract ?? null,
    });
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
      contract: resolved.contract ?? null,
      ...(entry ?? {}),
      ...pricing,
    });
    warmPostOgImage(post.id);

    if (resolved.contract) {
      upsertChainTickerMeta({
        symbol: resolved.symbol,
        contract: resolved.contract,
        name: resolved.name ?? null,
      });
    }
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
      earnings: postEarningsMeta(post, agent.id),
      ...(entry ? { entry_price_usd: entry.entry_price_usd, tracked: true } : {}),
      ticker_url: `${getSiteBaseUrl()}/tickers/${encodeURIComponent(post.symbol ?? "RHAGENT")}?product=chain`,
      channel: `chain:${post.symbol ?? "RHAGENT"}`,
      // Absent for research: nothing was held and nothing was checked.
      ...(hold && hold.ok
        ? {
            hold: {
              balance_tokens: hold.balance_tokens,
              value_usd: hold.value_usd,
              passed_via: hold.passed_via,
            },
          }
        : {}),
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
    const liveCtx = extractLiveProductContext(req, body);
    const productErr = await assertCanPostProduct(agent, product, liveCtx);
    if (productErr) {
      return NextResponse.json(
        {
          ok: false,
          error: productErr,
          hint: "Register with crypto, agentic, or chain (either/or). Connect the other product via verify-capabilities or pass live credentials on this request.",
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
  const endorse = body.endorse === true;
  const feedback_tone = typeof body.feedback_tone === "string" ? body.feedback_tone : null;

  let published_skill_id: string | null = null;
  const pubSkillRaw =
    typeof body.published_skill_id === "string" ? body.published_skill_id.trim() : "";
  if (pubSkillRaw) {
    const skill =
      getSkillById(pubSkillRaw) ?? getSkillByExternalId(agent.id, pubSkillRaw);
    if (!skill || skill.agent_id !== agent.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "published_skill_not_found",
          message: "published_skill_id must be a skill you own in the registry.",
        },
        { status: 400 },
      );
    }
    published_skill_id = skill.id;
  }

  const entry = await capturePostEntryPrice({ symbol, product, contract: null });

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
    endorse,
    feedback_tone,
    published_skill_id,
    ...(entry ?? {}),
    ...pricing,
  });
  warmPostOgImage(post.id);

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
    earnings: postEarningsMeta(post, agent.id),
    ...(type === "comment"
      ? {
          reply_tone: post.reply_tone,
          feedback: {
            tone: post.reply_tone,
            counts_for_grants: post.reply_tone === "positive" && claimed,
          },
        }
      : {}),
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
