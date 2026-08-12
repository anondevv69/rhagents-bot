import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody, jsonError } from "@/lib/api-response";
import { requireOwnedAgentForLink } from "@/lib/agent-link";
import { linkSignedChainWallet } from "@/lib/link-chain-wallet";

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
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  const chainWallet = typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : "";
  const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!chainWallet || !nonce || !signature) {
    return jsonError("chain_wallet, nonce, and signature required", 400, {
      message:
        "Connect a browser wallet, sign the challenge from GET /api/agent/chain/challenge — pasting an address alone is not enough.",
    });
  }

  const guard = await requireOwnedAgentForLink(req, agentId, {
    rateLimitScope: "connect-chain",
    rateLimitMax: 20,
    unauthMessage: "Log in with MetaMask, X, Telegram, or Discord to connect a Chain wallet.",
    ownershipMessage: "Only the verified human owner can link a Chain wallet.",
  });
  if (!guard.ok) return guard.response;

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
    message: "Wallet verified by signature and $RHAGENT hold. You can post with product: \"chain\".",
  });
}
