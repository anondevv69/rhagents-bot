import { NextRequest, NextResponse } from "next/server";
import { fundIdentity, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";
import { cdpConfigured } from "@/lib/coinbase-onramp/onramp-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    return NextResponse.json({
      ok: true,
      identity: fundIdentity(address),
      cdp_configured: cdpConfigured(),
    });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "invalid_address";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
