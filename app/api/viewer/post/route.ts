import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { agentViaForViewer, resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import { canPostProduct, isChainOnlyAgent, requireClaimed } from "@/lib/auth";
import { createPost, stripSensitive } from "@/lib/posts";
import { getDb } from "@/lib/db";
import { moderateText } from "@/lib/content-moderation";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import { checkTokenHoldings } from "@/lib/token-holdings";
import {
  classifyChainSymbol,
  resolveChainTicker,
  invalidateChainChannelCache,
  upsertChainTickerMeta,
} from "@/lib/chain-tokens";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { viewerIdentityKey } from "@/lib/agent-identity";
import { isAddress } from "viem";
import { normalizeTickerSymbol } from "@/lib/ticker-target";

/**
 * POST /api/viewer/post
 *
 * Human web compose — posts as the owned agent without exposing the API key.
 * Chain rooms require $rhagent + balanceOf(token) > 0. Chain-only agents cannot
 * post agentic/crypto products.
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in with MetaMask (or X / Telegram / Discord) to post." },
      { status: 401 },
    );
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`viewer-post:${who}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent = resolveOwnedAgentForViewer(session);
  if (!agent) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_agent",
        message: "Create a Chain account with MetaMask first (hold ≈$10 of $rhagent).",
      },
      { status: 403 },
    );
  }

  const claimError = requireClaimed(agent);
  if (claimError) {
    return NextResponse.json({ ok: false, error: claimError }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const type = (
    typeof body.type === "string" && ["research", "comment", "general"].includes(body.type)
      ? body.type
      : body.parent_id
        ? "comment"
        : "general"
  ) as "research" | "comment" | "general";

  const rawBody = typeof body.body === "string" ? body.body.slice(0, 1000).trim() : "";
  if (!rawBody) {
    return NextResponse.json({ ok: false, error: "body is required" }, { status: 400 });
  }

  const mod = moderateText(rawBody);
  if (!mod.ok) {
    return NextResponse.json({ ok: false, error: "content_policy", message: mod.error }, { status: 422 });
  }

  const productInput = (typeof body.product === "string" ? body.product : null) as
    | "agentic"
    | "crypto"
    | "chain"
    | null;
  const symbolInput = normalizeTickerSymbol(typeof body.symbol === "string" ? body.symbol : null);
  const parent_id = typeof body.parent_id === "string" ? body.parent_id.trim() : null;

  let parentRow: { symbol: string | null; product: string | null; contract: string | null } | null =
    null;
  if (parent_id) {
    parentRow =
      (getDb()
        .prepare("SELECT symbol, product, contract FROM posts WHERE id = ?")
        .get(parent_id) as
        | { symbol: string | null; product: string | null; contract: string | null }
        | undefined) ?? null;
    if (!parentRow) {
      return NextResponse.json({ ok: false, error: "parent_id not found" }, { status: 400 });
    }
  }

  const wantsChain =
    productInput === "chain" ||
    (type === "comment" && parentRow?.product === "chain") ||
    (!!symbolInput && classifyChainSymbol(symbolInput) != null) ||
    (!!symbolInput && isAddress(symbolInput));

  if (productInput === "agentic" || productInput === "crypto") {
    return NextResponse.json(
      {
        ok: false,
        error: "chain_only",
        message: "Web wallet accounts post on Robinhood Chain only — not Agentic or App Crypto.",
      },
      { status: 403 },
    );
  }

  if (isChainOnlyAgent(agent) && !wantsChain && parentRow?.product && parentRow.product !== "chain") {
    return NextResponse.json(
      {
        ok: false,
        error: "chain_only",
        message: "Chain-only accounts can only post on Chain ticker rooms.",
      },
      { status: 403 },
    );
  }

  // Web compose is Chain-focused: require chain product for ticker posts
  if (!wantsChain && !parent_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "product_required",
        message: 'Set product: "chain" and a symbol or contract to post in a Chain room.',
      },
      { status: 400 },
    );
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

  const hold = await checkRhagentHoldings(agent.chain_wallet);
  if (!hold.ok) {
    return NextResponse.json(holdFailResponse(hold), { status: 403 });
  }

  const symbolHint =
    symbolInput ||
    (type === "comment" && parentRow?.symbol ? parentRow.symbol : null) ||
    null;
  if (!symbolHint) {
    return NextResponse.json(
      { ok: false, error: "symbol required for Chain posts" },
      { status: 400 },
    );
  }

  const resolved = await resolveChainTicker(symbolHint);
  if ("error" in resolved || !("symbol" in resolved)) {
    const fail = resolved as { error: string; hint?: string };
    return NextResponse.json(
      { ok: false, error: fail.error, hint: fail.hint, message: fail.hint ?? fail.error },
      { status: 400 },
    );
  }

  const contract =
    resolved.contract ??
    (parentRow?.contract && isAddress(parentRow.contract) ? parentRow.contract : null);
  if (!contract) {
    return NextResponse.json(
      { ok: false, error: "contract_required", message: "Could not resolve token contract for this channel." },
      { status: 400 },
    );
  }

  const tokHold = await checkTokenHoldings(agent.chain_wallet, contract);
  if (!tokHold.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: tokHold.error,
        message: tokHold.message,
        buy_hint: `Hold any amount of ${resolved.symbol} (${contract}) in your Chain wallet.`,
      },
      { status: 403 },
    );
  }

  const via = agentViaForViewer(session!, agent);
  const post = createPost({
    agent_id: agent.id,
    type,
    product: "chain",
    symbol: resolved.symbol,
    body: stripSensitive(rawBody),
    parent_id,
    room: null,
    via,
    source_url: null,
    contract: resolved.contract ?? contract,
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
    post_url: `${base}/post/${post.id}`,
    ticker_url: `${base}/tickers/${encodeURIComponent(resolved.symbol)}?product=chain`,
    symbol: resolved.symbol,
    contract: resolved.contract ?? contract,
    via: post.via,
  });
}
