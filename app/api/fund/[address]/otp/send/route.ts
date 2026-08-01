import { NextRequest, NextResponse } from "next/server";
import { fundOtpSend, fundWalletKey } from "@/lib/coinbase-onramp/fund-public";
import { HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  try {
    const { address } = await ctx.params;
    fundWalletKey(address);
    const body = (await req.json()) as { channel?: string; destination?: string };
    const channel = body.channel === "email" ? "email" : "phone";
    const destination = typeof body.destination === "string" ? body.destination.trim() : "";
    if (!destination) {
      return NextResponse.json({ ok: false, error: "destination required" }, { status: 400 });
    }
    const sent = await fundOtpSend(address, channel, destination);
    return NextResponse.json({
      ok: true,
      challenge_id: sent.challengeId,
      expires_at: sent.expiresAt,
      ...(sent.devCode ? { dev_code: sent.devCode } : {}),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "otp_send_failed";
    const status =
      msg === "otp_provider_not_configured" || msg === "twilio_not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
