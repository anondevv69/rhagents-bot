import { NextRequest, NextResponse } from "next/server";
import { getDb, type Agent } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { linkSignedChainWallet } from "@/lib/link-chain-wallet";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/agent/connect-chain-wallet
 *
 * Human owner (viewer session) proves wallet ownership with personal_sign —
 * never by pasting an address alone.
 *
 * Body: { agent_id, chain_wallet, nonce, signature }
 * Challenge: GET /api/agent/chain/challenge?wallet=0x…
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in with MetaMask, X, Telegram, or Discord to connect a Chain wallet." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  const chainWallet = typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : "";
  const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!agentId) {
    return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
  }
  if (!chainWallet || !nonce || !signature) {
    return NextResponse.json(
      {
        ok: false,
        error: "chain_wallet, nonce, and signature required",
        message:
          "Connect a browser wallet, sign the challenge from GET /api/agent/chain/challenge — pasting an address alone is not enough.",
      },
      { status: 400 },
    );
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`connect-chain:${who}:${agentId}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent | undefined;
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  if (!viewerOwnsAgent(session, agent)) {
    return NextResponse.json(
      { ok: false, error: "Only the verified human owner can link a Chain wallet." },
      { status: 403 },
    );
  }

  const linked = await linkSignedChainWallet(agentId, {
    chain_wallet: chainWallet,
    nonce,
    signature,
  });
  if (!linked.ok) {
    return NextResponse.json(linked.body, { status: linked.status });
  }

  return NextResponse.json({
    ok: true,
    has_chain: true,
    chain_wallet: linked.chain_wallet,
    hold: linked.hold,
    message:
      "Wallet verified by signature and $rhagent hold. You can post with product: \"chain\".",
  });
}
