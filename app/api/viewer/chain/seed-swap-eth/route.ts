import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { seedSwapEthForWallet } from "@/lib/chain-onboard-seed";
import { explorerTxUrl } from "@/lib/onchain-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/viewer/chain/seed-swap-eth
 * One-time Robinhood Chain ETH from rhagent so the wallet can swap for $RHAGENT.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`chain-seed:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!session?.chain_wallet || !viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "wallet_session_required" }, { status: 401 });
  }

  const result = await seedSwapEthForWallet(session.chain_wallet);
  if (!result.ok) {
    const status =
      result.error === "already_seeded"
        ? 409
        : result.error === "seed_disabled"
          ? 503
          : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    tx_hash: result.tx_hash,
    explorer_url: explorerTxUrl(result.tx_hash),
    amount_eth: result.amount_eth,
    message: "ETH sent on Robinhood Chain — you can now swap for $RHAGENT.",
  });
}
