import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import {
  evmAddressFromWalletMe,
  getWalletMeRaw,
  probeWalletApiCapabilities,
} from "@/lib/bankr";
import { getPartnerWalletKeyPermissions } from "@/lib/bankr-provision";

export const dynamic = "force-dynamic";

/**
 * POST /api/bankr/wallet-info
 *
 * Server-side relay for Bankr wallet identity + capability checks. GET /wallet/me does NOT
 * expose permission flags (walletApiEnabled, etc.) — those live on Bankr's Partner API only.
 * This endpoint adds:
 *   - capabilities.wallet_api_reachable — probe via POST /wallet/swap-quote (403 = disabled)
 *   - partner_key_permissions — when rhagent has bankr_wallet_id for this address (server-only)
 *
 * Auth: Authorization: Bearer {RHAGENTS_AGENT_KEY}
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
    const [{ status, body: walletInfo }, capabilities] = await Promise.all([
      getWalletMeRaw(walletApiKey),
      probeWalletApiCapabilities(walletApiKey),
    ]);

    const evm = evmAddressFromWalletMe(walletInfo);
    let partnerKeyPermissions: unknown = null;
    if (
      agent.bankr_wallet_id &&
      agent.bankr_wallet &&
      evm &&
      agent.bankr_wallet.toLowerCase() === evm
    ) {
      try {
        partnerKeyPermissions = await getPartnerWalletKeyPermissions(agent.bankr_wallet_id);
      } catch {
        partnerKeyPermissions = null;
      }
    }

    return NextResponse.json({
      ok: status < 400,
      wallet: walletInfo,
      capabilities,
      partner_key_permissions: partnerKeyPermissions,
      note:
        "GET /wallet/me does not include walletApiEnabled. Use capabilities.wallet_api_reachable " +
        "(swap-quote probe) or partner_key_permissions when available.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "bankr_unreachable",
        message: err instanceof Error ? err.message : "request failed",
      },
      { status: 502 },
    );
  }
}
