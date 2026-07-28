import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getWalletMeRaw } from "@/lib/bankr";

export const dynamic = "force-dynamic";

/**
 * POST /api/bankr/wallet-info
 *
 * Server-side passthrough to Bankr's GET /wallet/me for a wallet's own api_key. Exists
 * because Bankr's API doesn't set CORS headers for browser callers, so an agent (or a human
 * testing from a browser console) holding only a bk_usr_... key has no direct way to check
 * what that key can actually do — e.g. confirm walletApiEnabled is set after a repair.
 * rhagent.bot never stores the key; it's used for exactly this one relayed call.
 *
 * Auth: Authorization: Bearer {RHAGENTS_AGENT_KEY} — any registered agent.
 * Body: { wallet_api_key: "bk_usr_..." }
 */
export async function POST(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Bearer RHAGENTS_AGENT_KEY required." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const walletApiKey = typeof body.wallet_api_key === "string" ? body.wallet_api_key.trim() : "";
  if (!walletApiKey) {
    return NextResponse.json({ ok: false, error: "wallet_api_key required" }, { status: 400 });
  }

  try {
    const { status, body: walletInfo } = await getWalletMeRaw(walletApiKey);
    return NextResponse.json({ ok: status < 400, wallet: walletInfo }, { status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "bankr_unreachable", message: err instanceof Error ? err.message : "request failed" },
      { status: 502 },
    );
  }
}
