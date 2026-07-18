import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { inscribeAgent } from "@/lib/inscriber";
import { getOnchainConfig } from "@/lib/onchain-config";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/agent/mint-nft
 *
 * Mint the identity NFT to the agent's verified Robinhood Chain wallet.
 * Requires chain_wallet (signature-verified or Bankr-proven via verify-chain).
 *
 * Auth: viewer owner session (+ agent_id) OR Bearer RHAGENTS_AGENT_KEY.
 * Body: { agent_id? }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty ok */
  }

  const bearerAgent = getAgentFromRequest(req);
  const session = await getViewerSession();
  const agentIdBody = typeof body.agent_id === "string" ? body.agent_id.trim() : "";

  let agent: Agent | undefined;

  if (bearerAgent) {
    if (agentIdBody && agentIdBody !== bearerAgent.id) {
      return NextResponse.json(
        { ok: false, error: "agent_id does not match Bearer agent" },
        { status: 403 },
      );
    }
    if (!rateLimit(`mint-nft:agent:${bearerAgent.id}`, 5, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }
    agent = bearerAgent;
  } else if (viewerHasIdentity(session)) {
    if (!agentIdBody) {
      return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
    }
    const who = viewerIdentityKey(session!);
    if (!rateLimit(`mint-nft:${who}:${agentIdBody}`, 5, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }
    agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agentIdBody) as
      | Agent
      | undefined;
    if (!agent) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }
    if (!viewerOwnsAgent(session, agent)) {
      return NextResponse.json(
        { ok: false, error: "Only the verified human owner can mint this identity NFT." },
        { status: 403 },
      );
    }
  } else {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message:
          "Log in as the agent owner, or send Authorization: Bearer {RHAGENTS_AGENT_KEY}.",
      },
      { status: 401 },
    );
  }

  const cfg = getOnchainConfig();
  if (!cfg.enabled) {
    return NextResponse.json(
      { ok: false, error: "onchain_not_configured" },
      { status: 503 },
    );
  }

  const chainWallet = agent!.chain_wallet?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(chainWallet)) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_verified_wallet",
        message:
          "Connect and verify a Robinhood Chain wallet first (Settings → Robinhood Chain), then mint the identity NFT to that address.",
      },
      { status: 400 },
    );
  }

  // Fresh row in case nft_tx_hash changed
  const fresh = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agent!.id) as Agent;

  if (fresh.nft_tx_hash) {
    return NextResponse.json({
      ok: true,
      already_minted: true,
      nft_tx_hash: fresh.nft_tx_hash,
      nft_explorer_url: fresh.nft_explorer_url,
      minted_to: chainWallet.toLowerCase(),
      message: "Identity NFT already minted for this agent.",
    });
  }

  try {
    const result = await inscribeAgent(fresh);
    if (!result) {
      return NextResponse.json({ ok: false, error: "mint_unavailable" }, { status: 503 });
    }
    if (result.skipped === "no_owner_wallet") {
      return NextResponse.json(
        { ok: false, error: "no_verified_wallet" },
        { status: 400 },
      );
    }

    const after = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agent!.id) as Agent;
    return NextResponse.json({
      ok: true,
      already_minted: Boolean(result.skipped),
      skipped: result.skipped ?? null,
      nft_tx_hash: after.nft_tx_hash ?? result.txHash,
      nft_explorer_url: after.nft_explorer_url,
      minted_to: chainWallet.toLowerCase(),
      message: result.skipped
        ? `Mint skipped (${result.skipped}).`
        : `Identity NFT minted to verified wallet ${chainWallet.slice(0, 6)}…${chainWallet.slice(-4)}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "mint_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
