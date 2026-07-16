import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setViewerCookie } from "@/lib/viewer";
import { loginOrRegisterWithChainWallet } from "@/lib/wallet-viewer-login";

/**
 * POST /api/viewer/wallet/login
 *
 * Body: { chain_wallet, nonce, signature, next? }
 * Challenge: GET /api/agent/chain/challenge?wallet=0x…
 *
 * Verifies personal_sign + $rhagent hold, then:
 * - finds existing agent with that chain_wallet, or
 * - creates a claimed Chain-only agent
 * Sets viewer cookie with chain_wallet.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`wallet-login:${clientIp(req)}`, 20, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const chain_wallet = typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : "";
  const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!chain_wallet || !nonce || !signature) {
    return NextResponse.json(
      { ok: false, error: "chain_wallet, nonce, and signature required" },
      { status: 400 },
    );
  }

  const result = await loginOrRegisterWithChainWallet({ chain_wallet, nonce, signature });
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const payload: Record<string, unknown> = {
    ok: true,
    created: result.created,
    chain_wallet: result.chain_wallet,
    agent_id: result.agent_id,
    username: result.username,
    display_name: result.display_name,
    profile_url: result.username ? `/agent/${result.username}` : "/account",
    hold: result.hold,
  };
  if (result.api_key) {
    payload.api_key = result.api_key;
    payload.api_key_notice =
      "Save this agent key now — it is only shown once. Use it for trade-post / Bankr. Never share it.";
  }

  return setViewerCookie(NextResponse.json(payload), { chain_wallet: result.chain_wallet });
}
