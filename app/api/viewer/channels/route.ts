import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey } from "@/lib/agent-identity";
import { resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import { canPostProduct, requireClaimed } from "@/lib/auth";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import { checkTokenHoldings } from "@/lib/token-holdings";
import {
  resolveChainTicker,
  invalidateChainChannelCache,
  upsertChainTickerMeta,
  getChainTickerMeta,
} from "@/lib/chain-tokens";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isAddress } from "viem";

/**
 * POST /api/viewer/channels
 * Body: { contract: "0x…" }
 *
 * Create / open a Chain ticker room if the wallet holds any amount of the token
 * and ≈$10 of $RHAGENT. Token must be a real Robinhood Chain listing.
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in with MetaMask to create a Chain channel." },
      { status: 401 },
    );
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`viewer-channel:${who}`, 20, 60 * 60 * 1000)) {
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
    return NextResponse.json({ ok: false, error: "No chain_wallet on this agent." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const contractRaw =
    (typeof body.contract === "string" ? body.contract.trim() : "") ||
    (typeof body.symbol === "string" && isAddress(body.symbol.trim()) ? body.symbol.trim() : "");

  if (!contractRaw || !isAddress(contractRaw)) {
    return NextResponse.json(
      {
        ok: false,
        error: "contract_required",
        message: "Paste a Robinhood Chain ERC-20 contract (0x…).",
      },
      { status: 400 },
    );
  }

  const hold = await checkRhagentHoldings(agent.chain_wallet);
  if (!hold.ok) {
    return NextResponse.json(holdFailResponse(hold), { status: 403 });
  }

  const tokHold = await checkTokenHoldings(agent.chain_wallet, contractRaw);
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

  const resolved = await resolveChainTicker(contractRaw);
  if ("error" in resolved || !("symbol" in resolved)) {
    const fail = resolved as { error: string; hint?: string };
    return NextResponse.json(
      {
        ok: false,
        error: fail.error,
        hint: fail.hint,
        message: fail.hint ?? fail.error,
      },
      { status: 400 },
    );
  }

  if (!resolved.contract) {
    return NextResponse.json({ ok: false, error: "Could not resolve contract" }, { status: 400 });
  }

  upsertChainTickerMeta({
    symbol: resolved.symbol,
    contract: resolved.contract,
    name: resolved.name ?? null,
  });
  invalidateChainChannelCache();

  const meta = getChainTickerMeta(resolved.symbol);
  const base = getSiteBaseUrl();
  const channel_url = `${base}/tickers/${encodeURIComponent(resolved.symbol)}?product=chain`;

  return NextResponse.json({
    ok: true,
    created: true,
    symbol: resolved.symbol,
    contract: resolved.contract,
    name: resolved.name ?? meta?.name ?? null,
    channel_url,
    message: `Channel $${resolved.symbol} is ready. Hold the token + $RHAGENT to post.`,
  });
}
