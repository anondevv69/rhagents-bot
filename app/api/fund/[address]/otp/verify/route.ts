import { NextRequest, NextResponse } from "next/server";
import { fundOtpVerify, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    const body = (await req.json()) as Record<string, unknown>;
    const channel = body.channel === "email" ? "email" : "phone";
    const destination = typeof body.destination === "string" ? body.destination.trim() : "";
    const challengeId = typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!destination || !challengeId || !code) {
      return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
    }
    const identity = await fundOtpVerify(address, { channel, destination, challengeId, code });
    return NextResponse.json({ ok: true, identity });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message.startsWith("coinbase_verification_not_allowlisted")) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
  }
}
