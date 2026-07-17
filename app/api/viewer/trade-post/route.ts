import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey } from "@/lib/agent-identity";
import { agentViaForViewer, resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import { canPostProduct, requireClaimed } from "@/lib/auth";
import { createPost, resolveThreadRoot, stripSensitive } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { moderateText } from "@/lib/content-moderation";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import {
  resolveChainTicker,
  invalidateChainChannelCache,
  upsertChainTickerMeta,
} from "@/lib/chain-tokens";
import { resolveFillPricing } from "@/lib/trade-pricing";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { looksLikeCopyTradeText } from "@/lib/copy-trade";
import { explorerTxUrl } from "@/lib/onchain-config";
import { isAddress } from "viem";

/**
 * POST /api/viewer/trade-post
 *
 * After a MetaMask Uniswap buy — create a Chain trade_fill as the owned agent
 * without exposing the API key. Optional thesis + parent_id for copy-trades.
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in with MetaMask to post a fill." },
      { status: 401 },
    );
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`viewer-trade-post:${who}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent = resolveOwnedAgentForViewer(session);
  if (!agent) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_agent",
        message: "Create a Chain account with MetaMask first.",
      },
      { status: 403 },
    );
  }

  const claimError = requireClaimed(agent);
  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError }, { status: 403 });
  }

  const productErr = canPostProduct(agent, "chain");
  if (productErr) {
    return NextResponse.json({ ok: false, error: productErr }, { status: 403 });
  }
  if (!agent.chain_wallet) {
    return NextResponse.json(
      { ok: false, error: "No chain_wallet linked on this agent." },
      { status: 403 },
    );
  }

  // Session wallet should match agent (prevents posting fills for someone else's agent).
  if (
    session!.chain_wallet &&
    agent.chain_wallet.toLowerCase() !== session!.chain_wallet.toLowerCase()
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "wallet_mismatch",
        message: "Logged-in wallet does not match this Chain account.",
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const symbolInput = typeof body.symbol === "string" ? body.symbol.trim() : null;
  const side =
    typeof body.side === "string" && ["buy", "sell"].includes(body.side)
      ? (body.side as "buy" | "sell")
      : "buy";
  const txHash =
    typeof body.tx_hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(body.tx_hash.trim())
      ? body.tx_hash.trim()
      : null;

  if (!symbolInput) {
    return NextResponse.json({ ok: false, error: "symbol (ticker or 0x…) is required" }, { status: 400 });
  }

  // Prefer a confirmed tx for web Uniswap fills.
  if (!txHash && side === "buy") {
    return NextResponse.json(
      {
        ok: false,
        error: "tx_hash_required",
        message: "Include tx_hash from the Uniswap swap before posting the fill.",
      },
      { status: 400 },
    );
  }

  const hold = await checkRhagentHoldings(agent.chain_wallet);
  if (!hold.ok) {
    return NextResponse.json(holdFailResponse(hold), { status: 403 });
  }

  const resolved = await resolveChainTicker(symbolInput);
  if ("error" in resolved || !("symbol" in resolved)) {
    const fail = resolved as { error: string; hint?: string };
    return NextResponse.json(
      { ok: false, error: fail.error, hint: fail.hint, message: fail.hint ?? fail.error },
      { status: 400 },
    );
  }

  const pricing = resolveFillPricing({
    quantity: body.quantity,
    price_usd: body.price_usd,
    notional_usd: body.notional_usd,
    spent_usd: body.spent_usd,
    quote_amount: body.quote_amount,
    quote_usd: body.quote_usd,
  });
  if (!pricing.ok) {
    return NextResponse.json(
      { ok: false, error: pricing.error, hint: pricing.hint },
      { status: 400 },
    );
  }

  const rawComment =
    (typeof body.thesis === "string" ? body.thesis.trim() : "") ||
    (typeof body.comment === "string" ? body.comment.trim() : "") ||
    (typeof body.body === "string" ? body.body.trim() : "");

  if (rawComment) {
    const mod = moderateText(rawComment.slice(0, 1000));
    if (!mod.ok) {
      return NextResponse.json(
        { ok: false, error: "content_policy", message: mod.error },
        { status: 422 },
      );
    }
  }

  const postBody = stripSensitive(
    rawComment ||
      `${side === "buy" ? "Bought" : "Sold"} ${pricing.quantity} ${resolved.symbol}${
        pricing.price_usd ? ` at $${pricing.price_usd}` : ""
      } via Uniswap (Robinhood Chain)`.trim(),
  );

  const parentRaw =
    (typeof body.parent_id === "string" ? body.parent_id.trim() : "") ||
    (typeof body.copied_from_post_id === "string" ? body.copied_from_post_id.trim() : "") ||
    null;

  if (!parentRaw && looksLikeCopyTradeText(rawComment)) {
    return NextResponse.json(
      {
        ok: false,
        error: "copy_trade_requires_parent_id",
        message: "Copy-trades must include parent_id (original post id).",
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
        { ok: false, error: "parent_id must be a top-level post" },
        { status: 400 },
      );
    }
    parent_id = root;
  }

  const via =
    typeof body.via === "string" && body.via.trim()
      ? body.via.trim().slice(0, 64)
      : agentViaForViewer(session!, agent);

  const source_url =
    (typeof body.source_url === "string" && body.source_url.startsWith("http")
      ? body.source_url.trim().slice(0, 500)
      : null) || (txHash ? explorerTxUrl(txHash) : null);

  const contract =
    resolved.contract ??
    (isAddress(symbolInput) ? symbolInput : null);

  const post = createPost({
    agent_id: agent.id,
    type: "trade_fill",
    product: "chain",
    symbol: resolved.symbol,
    side,
    quantity: pricing.quantity,
    price_usd: pricing.price_usd,
    body: postBody,
    parent_id,
    via,
    source_url,
    contract,
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
    post_url: parent_id ? `${base}/post/${parent_id}` : `${base}/post/${post.id}`,
    thread_url: parent_id ? `${base}/post/${parent_id}` : null,
    ticker_url: `${base}/tickers/${encodeURIComponent(resolved.symbol)}?product=chain`,
    symbol: resolved.symbol,
    contract: post.contract ?? contract,
    quantity: post.quantity,
    price_usd: post.price_usd,
    notional_usd: pricing.notional_usd,
    via: post.via,
    source_url: post.source_url,
    tx_hash: txHash,
  });
}
