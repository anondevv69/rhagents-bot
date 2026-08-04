import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { activateChainProfileForWallet } from "@/lib/wallet-viewer-login";

export const dynamic = "force-dynamic";

/**
 * POST /api/viewer/wallet/activate-chain
 * Create (or return) a claimed Chain agent when $rhagent hold passes — session must already own the wallet.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`activate-chain:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const session = await getViewerSession();
  if (!session?.chain_wallet || !viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "wallet_session_required" }, { status: 401 });
  }

  const result = await activateChainProfileForWallet(session.chain_wallet);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const payload: Record<string, unknown> = {
    ok: true,
    created: result.created,
    agent_id: result.agent_id,
    username: result.username,
    display_name: result.display_name,
    profile_url: result.profile_url,
  };
  if (result.api_key) {
    payload.api_key = result.api_key;
    payload.api_key_notice = "Save this agent key now — shown once.";
  }

  return NextResponse.json(payload);
}
