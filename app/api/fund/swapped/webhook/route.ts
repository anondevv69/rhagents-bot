import { NextRequest, NextResponse } from "next/server";
import { handleSwappedWebhook } from "@/lib/swapped-ramp/webhook-handler";
import { fundDepositsEnabled } from "@/lib/fund-deposits";

export const dynamic = "force-dynamic";

/**
 * Swapped Ramp order webhook.
 * Signature: base64(HMAC-SHA256(raw_request_body, secret_key)) via `signature` header.
 * Credits only on order_broadcasted (final on-ramp success); 409 if order_id already credited.
 */
export async function POST(req: NextRequest) {
  if (!fundDepositsEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "deposits_disabled" });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("signature");

  const result = await handleSwappedWebhook(rawBody, signature);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      already_credited: result.alreadyCredited,
      credited: result.credited,
      notified: result.notified,
    },
    { status: result.httpStatus },
  );
}
