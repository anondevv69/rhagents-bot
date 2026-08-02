import { NextRequest, NextResponse } from "next/server";
import { handleSwappedWebhook } from "@/lib/swapped-ramp/webhook-handler";

export const dynamic = "force-dynamic";

/**
 * Swapped Ramp order webhook.
 * Verifies `signature` header against the raw body (never re-stringify before verify).
 * Credits idempotently on order_completed / order_broadcasted; returns 409 if already credited.
 */
export async function POST(req: NextRequest) {
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
