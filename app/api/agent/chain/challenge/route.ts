import { NextRequest, NextResponse } from "next/server";
import { createChainWalletChallenge } from "@/lib/chain-proof";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * GET /api/agent/chain/challenge?wallet=0x…
 * Returns a message to personal_sign proving wallet ownership.
 */
export async function GET(req: NextRequest) {
  if (!rateLimit(`chain-challenge:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  const result = createChainWalletChallenge(wallet);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ...result,
    next: "personal_sign the message, then pass chain_wallet + nonce + signature to register/start (capability=chain) or POST /api/agent/verify-chain",
  });
}
