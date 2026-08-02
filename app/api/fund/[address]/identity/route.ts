import { NextRequest, NextResponse } from "next/server";
import { fundIdentity, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";
import { cdpConfigured, onrampSandboxEnabled } from "@/lib/coinbase-onramp/onramp-client";
import { swappedConfigured, swappedSandboxEnabled } from "@/lib/swapped-ramp/swapped-ramp-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    const swapped = swappedConfigured();
    const cdp = cdpConfigured();
    return NextResponse.json({
      ok: true,
      identity: fundIdentity(address),
      cdp_configured: cdp,
      sandbox: onrampSandboxEnabled(),
      swapped_configured: swapped,
      swapped_sandbox: swappedSandboxEnabled(),
      provider: swapped ? "swapped" : cdp ? "coinbase" : null,
    });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "invalid_address";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
