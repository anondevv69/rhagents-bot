import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import {
  BANKR_CLUB_MONTHLY_USD,
  fetchBaseUsdcBalance,
  fetchClubStatus,
  mintKeyForProvisionedWallet,
} from "@/lib/bankr-club";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/viewer/bankr/pro/status
 *
 * Pro (Bankr Club) status for the viewer's owned agent's managed wallet.
 * For partner-provisioned wallets we mint an ephemeral key server-side to read
 * status; for externally linked wallets the client must send its bk_usr_* key
 * to the activate endpoint instead (needs_key: true here).
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`bankr-pro-status:${clientIp(req)}`, 30, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!session || !viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "session_required" }, { status: 401 });
  }

  const agent = resolveOwnedAgentForViewer(session);
  if (!agent) {
    return NextResponse.json({
      ok: true,
      has_agent: false,
      has_bankr_wallet: false,
      price_usd: BANKR_CLUB_MONTHLY_USD,
    });
  }

  const bankrWallet = agent.bankr_wallet?.toLowerCase() ?? null;
  if (!bankrWallet) {
    return NextResponse.json({
      ok: true,
      has_agent: true,
      agent_username: agent.username,
      has_bankr_wallet: false,
      price_usd: BANKR_CLUB_MONTHLY_USD,
    });
  }

  // Provisioned wallets: mint an ephemeral key to read club status + USDC balance.
  let club = null;
  let usdc: number | null = null;
  let needsKey = false;
  const key = await mintKeyForProvisionedWallet(agent);
  if (key) {
    [club, usdc] = await Promise.all([fetchClubStatus(key), fetchBaseUsdcBalance(key)]);
  } else {
    needsKey = true;
  }

  return NextResponse.json({
    ok: true,
    has_agent: true,
    agent_username: agent.username,
    has_bankr_wallet: true,
    bankr_wallet: bankrWallet,
    provisioned: !!agent.bankr_provisioned,
    needs_key: needsKey,
    club,
    base_usdc: usdc,
    price_usd: BANKR_CLUB_MONTHLY_USD,
    funded: usdc != null ? usdc >= BANKR_CLUB_MONTHLY_USD : null,
  });
}
