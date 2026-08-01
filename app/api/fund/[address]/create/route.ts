import { NextRequest, NextResponse } from "next/server";
import { fundCreateDeposit, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    const body = (await req.json()) as { payment_amount?: string; paymentAmount?: string };
    const paymentAmount = (body.payment_amount ?? body.paymentAmount ?? "").trim();
    if (!paymentAmount) {
      return NextResponse.json({ ok: false, error: "payment_amount required" }, { status: 400 });
    }
    const result = await fundCreateDeposit(address, paymentAmount);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[fund/create]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
