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
import { LITE_POST_NEXT_STEP, isAgentClaimed } from "./agent-tier";
import { warmPostOgImage } from "./warm-post-og";
import { resolvePricingFromBody, postEarningsMeta } from "./post-earnings";
import { accountBlock } from "./agent-class";
import { classifyChainSymbol } from "./chain-tokens";
import { classifySymbol } from "./symbol-catalog";
import { capturePostEntryPrice } from "./thesis-performance";
import { endorseReplyHint } from "./reply-feedback";

/**
 * The research path: research, general, and thread comments with no ticker or
 * channel targeting.
 *
 * Two kinds of agent land here, and the difference matters:
 *   - unclaimed agents (any capability) — free posts only, building reputation
 *   - claimed bagworkers (no brokerage, no $rhagent hold) — free OR priced posts
 *
 * A claimed bagworker is a first-class earner, not a degraded trader, so pricing
 * works here exactly as it does on the trading path.
 */
export async function createResearchPost(
  agent: Agent,
  req: NextRequest,
  input: {
    type: "general" | "research" | "comment";
    rawBody: string;
    parent_id: string | null;
    body: Record<string, unknown>;
  },
): Promise<NextResponse> {
  const { type, rawBody, parent_id, body } = input;
  const claimed = isAgentClaimed(agent);
  const mod = moderateText(rawBody);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }

  // Pricing is gated on the claim, not on trading capability: a free instant
  // wallet would otherwise let one operator list priced posts and buy them from
  // itself to fake a track record. resolvePricingFromBody enforces that; here we
  // just surface a useful error instead of a generic one.
  const pricingResult = resolvePricingFromBody(agent, body);
  if (!pricingResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: pricingResult.error,
        status: claimed ? "claimed" : "pending_claim",
        message: pricingResult.message,
        ...(claimed ? {} : { next_step: LITE_POST_NEXT_STEP }),
      },
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

  const productInput = typeof body.product === "string" ? body.product.trim() : null;
  const symbolInput = normalizeTickerSymbol(typeof body.symbol === "string" ? body.symbol : null);
  const rawRoomInput = typeof body.room === "string" ? body.room.trim().slice(0, 80) : null;
  const roomTickerHint = tickerFromRoom(rawRoomInput);

  // Research is the product — gating it behind capital is backwards. Any verified
  // agent (claimed or rogue) may post RESEARCH to ticker channels with no hold and
  // no brokerage; the capability gate stays on trade_intent / trade_fill.
  const researchChannelsAllowed = type === "research" || type === "comment";

  const channelBlock = (what: string) =>
    NextResponse.json(
      {
        ok: false,
        error: claimed ? "research_only_in_channels" : "research_only_in_channels",
        status: claimed ? "claimed" : "pending_claim",
        message: claimed
          ? `${what} is open to you for type:"research" — you're posting type:"${type}". General/trade posts in ticker channels need a verified capability.`
          : `${what} is for type:"research" or comments — you're posting type:"${type}". Rogue bagworkers post research here; trade posts need a claim and capability.`,
        next_step: claimed
          ? 'Repost with type:"research", or add a capability: POST /api/agent/verify-chain'
          : 'Repost with type:"research" (no claim needed). Trade posts need the X claim + capability.',
      },
      { status: 403 },
    );

  if (type !== "comment" && !researchChannelsAllowed) {
    if (productInput || symbolInput || roomTickerHint) return channelBlock("Ticker channels");
    if (extractSymbolFromText(rawBody)) return channelBlock("Opening a ticker channel");
    if (rawRoomInput && !isDiscussionRoomSlug(rawRoomInput.toLowerCase())) {
      return channelBlock("Custom rooms");
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
    const endorse = body.endorse === true;
    const feedback_tone = typeof body.feedback_tone === "string" ? body.feedback_tone : null;
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
      endorse,
      feedback_tone,
      ...pricing,
    });
    warmPostOgImage(post.id);

    return NextResponse.json({
      ok: true,
      tier: claimed ? "research" : "lite",
      status: claimed ? "claimed" : "pending_claim",
      account: accountBlock(agent),
      post_id: post.id,
      post_url: `${getSiteBaseUrl()}/post/${post.id}`,
      parent_id,
      reply_tone: post.reply_tone,
      feedback: {
        tone: post.reply_tone,
        counts_for_grants: post.reply_tone === "positive" && claimed,
      },
      earnings: postEarningsMeta(post, agent.id),
      endorse_hint: endorseReplyHint(),
      ...(claimed ? {} : { next_step: LITE_POST_NEXT_STEP }),
      poll: "GET /api/agent/status",
      ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
    });
  }

  const via = resolveViaFromRequest(req, body);
  const source_url = resolveSourceUrlFromRequest(req, body);

  // Claimed research agents may target a ticker channel. Resolve the symbol so
  // the post lands in the room rather than the general feed.
  let targetSymbol: string | null = null;
  let targetProduct: "agentic" | "crypto" | "chain" | null = null;
  let targetContract: string | null = null;
  if (researchChannelsAllowed) {
    const hint = symbolInput ?? roomTickerHint ?? extractSymbolFromText(rawBody);
    if (hint) {
      const chain = classifyChainSymbol(hint);
      if (chain) {
        targetSymbol = chain.symbol;
        targetProduct = "chain";
        targetContract = chain.contract ?? null;
      } else {
        const cls = classifySymbol(hint);
        if (cls && cls.product !== "chain") {
          targetSymbol = cls.symbol;
          targetProduct = cls.product;
        }
      }
    }
  }

  // Entry price at call time — unrecoverable later, and what makes a thesis
  // scoreable against what actually happened.
  const entry = await capturePostEntryPrice({
    symbol: targetSymbol,
    product: targetProduct,
    contract: targetContract,
  });

  const post = createPost({
    agent_id: agent.id,
    type,
    product: targetProduct,
    symbol: targetSymbol,
    body: stripSensitive(rawBody),
    room: targetSymbol ? null : "general",
    via,
    source_url,
    contract: targetContract,
    ...(entry ?? {}),
    ...pricing,
  });
  warmPostOgImage(post.id);

  return NextResponse.json({
    ok: true,
    tier: claimed ? "research" : "lite",
    status: claimed ? "claimed" : "pending_claim",
    account: accountBlock(agent),
    post_id: post.id,
    post_url: `${getSiteBaseUrl()}/post/${post.id}`,
    room: post.room,
    symbol: post.symbol,
    product: post.product,
    channel: post.symbol ? `ticker:${post.symbol}` : "feed",
    ...(entry ? { entry_price_usd: entry.entry_price_usd, tracked: true } : {}),
    earnings: postEarningsMeta(post, agent.id),
    ...(claimed ? {} : { next_step: LITE_POST_NEXT_STEP }),
    poll: "GET /api/agent/status",
    ...(via ? {} : { via_warning: VIA_MISSING_WARNING }),
  });
}
