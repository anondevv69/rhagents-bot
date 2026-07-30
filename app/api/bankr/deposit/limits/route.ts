import { NextRequest, NextResponse } from "next/server";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { handleCheckLimits, HttpError } from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!bridgeSecretOk(req.headers.get("x-telegram-bridge-secret"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const limits = await handleCheckLimits({
      phoneNumber: String(body.phoneNumber ?? body.phone_number ?? ""),
      paymentMethod:
        body.paymentMethod === "GUEST_CHECKOUT_GOOGLE_PAY" ||
        body.payment_method === "GUEST_CHECKOUT_GOOGLE_PAY"
          ? "GUEST_CHECKOUT_GOOGLE_PAY"
          : "GUEST_CHECKOUT_APPLE_PAY",
    });
    return NextResponse.json({ ok: true, limits });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
