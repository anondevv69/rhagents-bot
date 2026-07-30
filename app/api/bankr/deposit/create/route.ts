import { NextRequest, NextResponse } from "next/server";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import {
  handleCreateDeposit,
  HttpError,
} from "@/lib/coinbase-onramp/deposit-routes";

export const dynamic = "force-dynamic";

function depositError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  console.error("[deposit/create]", err);
  return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
}

/** POST /api/bankr/deposit/create — Coinbase Headless Onramp order (Telegram bridge or agent). */
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

  const platform = body.platform === "discord" ? "discord" : body.platform === "agent" ? "agent" : "telegram";
  const platformUserId =
    platform === "discord"
      ? String(body.discord_id ?? "").trim()
      : platform === "agent"
        ? String(body.agent_id ?? body.platformUserId ?? "").trim()
        : String(body.telegram_id ?? body.platformUserId ?? "").trim();

  try {
    const result = await handleCreateDeposit({
      platform,
      platformUserId,
      phoneNumber: typeof body.phoneNumber === "string" ? body.phoneNumber : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      paymentAmount: String(body.paymentAmount ?? body.payment_amount ?? ""),
      asset: typeof body.asset === "string" ? body.asset : undefined,
      paymentMethod:
        body.paymentMethod === "GUEST_CHECKOUT_GOOGLE_PAY" ||
        body.payment_method === "GUEST_CHECKOUT_GOOGLE_PAY"
          ? "GUEST_CHECKOUT_GOOGLE_PAY"
          : "GUEST_CHECKOUT_APPLE_PAY",
      domain: typeof body.domain === "string" ? body.domain : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return depositError(err);
  }
}
