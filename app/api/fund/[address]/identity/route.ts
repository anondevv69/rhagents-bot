import { NextRequest, NextResponse } from "next/server";
import { fundIdentity, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";
import { cdpConfigured, onrampSandboxEnabled } from "@/lib/coinbase-onramp/onramp-client";
import { swappedConfigured, swappedSandboxEnabled } from "@/lib/swapped-ramp/swapped-ramp-client";
import {
  fundDepositsEnabled,
  FUND_DEPOSITS_DISABLED_MESSAGE,
} from "@/lib/fund-deposits";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    const depositsEnabled = fundDepositsEnabled();
    const swapped = depositsEnabled && swappedConfigured();
    const cdp = depositsEnabled && cdpConfigured();
    return NextResponse.json({
      ok: true,
      identity: fundIdentity(address),
      deposits_enabled: depositsEnabled,
      deposits_disabled_message: depositsEnabled ? null : FUND_DEPOSITS_DISABLED_MESSAGE,
      cdp_configured: cdp,
      sandbox: onrampSandboxEnabled(),
      swapped_configured: swapped,
      swapped_sandbox: depositsEnabled && swappedSandboxEnabled(),
      provider: swapped ? "swapped" : cdp ? "coinbase" : null,
    });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "invalid_address";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
