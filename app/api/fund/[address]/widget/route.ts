import { NextRequest, NextResponse } from "next/server";
import { fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";
import {
  buildSwappedWidgetUrl,
  parseFundAmountUsd,
  swappedConfigured,
  swappedDisplayMeta,
} from "@/lib/swapped-ramp/swapped-ramp-client";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    if (!swappedConfigured()) {
      return NextResponse.json({ ok: false, error: "swapped_not_configured" }, { status: 503 });
    }

    const { address } = await ctx.params;
    const wallet = fundWalletKey(address);
    const amountRaw = req.nextUrl.searchParams.get("amount")?.trim() ?? "";
    if (!parseFundAmountUsd(amountRaw)) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
    }

    const widgetUrl = buildSwappedWidgetUrl({
      walletAddress: wallet,
      amountUsd: amountRaw,
      externalCustomerId: wallet,
    });

    return NextResponse.json({
      ok: true,
      widgetUrl,
      ...swappedDisplayMeta(),
    });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "invalid_address";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
