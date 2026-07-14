import { NextRequest, NextResponse } from "next/server";
import { consumeTelegramVerification } from "@/lib/telegram-viewer";
import { setViewerCookie } from "@/lib/viewer";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/viewer/telegram/complete
 * Body: { code }
 * Poll this after opening the deep link — succeeds once the human hits /start on the bot.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`tg-viewer-complete:${clientIp(req)}`, 60, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  }

  const verified = consumeTelegramVerification(code);
  if (!verified) {
    return NextResponse.json({ ok: true, verified: false });
  }

  return setViewerCookie(
    NextResponse.json({ ok: true, verified: true, telegram_username: verified.telegram_username }),
    { telegram_id: verified.telegram_id },
  );
}
