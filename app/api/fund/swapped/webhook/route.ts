import { NextRequest, NextResponse } from "next/server";
import { handleSwappedWebhook } from "@/lib/swapped-ramp/webhook-handler";

export const dynamic = "force-dynamic";

/** Swapped Ramp order notifications — verify `signature` header against raw body. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("signature");

  const result = await handleSwappedWebhook(rawBody, signature);
  if (!result.ok) {
    const status = result.error === "invalid_signature" ? 401 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    notified: result.notified,
  });
}
