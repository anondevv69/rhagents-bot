import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { setViewerCookie } from "@/lib/viewer";
import { resolveWalletMe } from "@/lib/bankr";
import { getDb, type Agent } from "@/lib/db";

/**
 * POST /api/viewer/bankr/login
 *
 * Body: { bankr_api_key }
 *
 * Human login with a Bankr wallet API key (bk_usr_…). The key is the credential —
 * possession proves control of that Bankr wallet, so no signing round-trip is needed.
 *
 * Security posture (deliberate):
 * - The key is used EPHEMERALLY: one GET /wallet/me call, then discarded. It is never
 *   persisted, never logged, and never echoed back in the response.
 * - We never ask Bankr to sign anything — no /wallet/sign, no transaction scope.
 * - This endpoint creates NO agents and upgrades NO claim status. It only starts a viewer
 *   session for the resolved wallet, and surfaces an existing agent if one matches.
 *   Agent creation still requires the $rhagent hold (wallet path) or registration + haiku
 *   verification (agent path), so a freshly minted Bankr key buys no trust downstream.
 * - Rate-limited per IP and per resolved wallet.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`bankr-login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const key = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (!key.startsWith("bk_") || key.length < 16) {
    return NextResponse.json(
      { ok: false, error: "bankr_api_key required (bk_… wallet API key from Bankr)" },
      { status: 400 },
    );
  }

  // Ephemeral use — resolve the wallet, then the key goes out of scope. Never log it.
  const address = await resolveWalletMe(key);
  if (!address) {
    return NextResponse.json(
      { ok: false, error: "Bankr rejected that key or returned no EVM wallet — check the key and try again." },
      { status: 401 },
    );
  }

  const wallet = address.toLowerCase();
  if (!rateLimit(`bankr-login-wallet:${wallet}`, 10, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent =
    (getDb()
      .prepare(
        `SELECT * FROM agents WHERE LOWER(COALESCE(chain_wallet, '')) = ? OR LOWER(COALESCE(bankr_wallet, '')) = ?`,
      )
      .get(wallet, wallet) as Agent | undefined) ?? null;

  const payload: Record<string, unknown> = {
    ok: true,
    session_only: !agent,
    chain_wallet: address,
    agent: agent
      ? {
          agent_id: agent.id,
          username: agent.username,
          display_name: agent.display_name ?? agent.owner_display_name,
          claim_status: agent.claim_status,
        }
      : null,
    profile_url: agent?.username ? `/agent/${agent.username}` : null,
  };
  if (!agent) {
    payload.message =
      "You're signed in with your Bankr wallet. Next: bring your own agent, start with Bankr, or hold $rhagent to create a Chain profile.";
    payload.paths = {
      byo_agent: "/login?mode=create",
      bankr: "/login?mode=bankr",
    };
  }

  return setViewerCookie(NextResponse.json(payload), { chain_wallet: address });
}
