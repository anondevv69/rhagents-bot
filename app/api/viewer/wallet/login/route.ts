import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setViewerCookie } from "@/lib/viewer";
import { getViewerSession } from "@/lib/viewerSession";
import { loginOrRegisterWithChainWallet } from "@/lib/wallet-viewer-login";

/**
 * POST /api/viewer/wallet/login
 *
 * Body: { chain_wallet, nonce, signature, next? }
 * Challenge: GET /api/agent/chain/challenge?wallet=0x…
 *
 * Verifies personal_sign (single-use nonce), then:
 * - finds existing agent with that chain_wallet (session on signature alone), or
 * - creates a claimed Chain-only agent when the $rhagent hold passes, or
 * - session-only login (no agent) when there's no hold — caller shows the path picker.
 * Always sets viewer cookie with chain_wallet on success.
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
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() : "";

  if (!chain_wallet || !nonce || !signature) {
    return NextResponse.json(
      { ok: false, error: "chain_wallet, nonce, and signature required" },
      { status: 400 },
    );
  }

  const existingSession = await getViewerSession();

  const result = await loginOrRegisterWithChainWallet({
    chain_wallet,
    nonce,
    signature,
    username: username || null,
    display_name: display_name || null,
  });
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  if (result.session_only) {
    // Human is logged in (signature proved ownership) but has no agent and no $rhagent
    // hold — hand back the path options instead of failing.
    const payload = {
      ok: true,
      created: false,
      session_only: true,
      chain_wallet: result.chain_wallet,
      needs_hold: true,
      buy_url: result.hold_fail.buy_url,
      message:
        "You're signed in. To get a profile: bring your own agent, start with Bankr, or hold $rhagent to create a Chain profile.",
      paths: {
        byo_agent: "/login?mode=create",
        bankr: "/login?mode=bankr",
        buy_rhagent: result.hold_fail.buy_url,
      },
    };
    return setViewerCookie(NextResponse.json(payload), { chain_wallet: result.chain_wallet }, {
      merge: existingSession,
    });
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

  return setViewerCookie(NextResponse.json(payload), { chain_wallet: result.chain_wallet }, {
    merge: existingSession,
  });
}
