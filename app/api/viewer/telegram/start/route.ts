import { NextResponse } from "next/server";
import { createTelegramViewerCode } from "@/lib/telegram-viewer";
import { telegramConfigured, telegramDeepLink } from "@/lib/telegram";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/** POST /api/viewer/telegram/start — mint a one-time code + deep link for "Log in with Telegram". */
export async function POST(req: Request) {
  if (!rateLimit(`tg-viewer-start:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "Telegram login not configured" }, { status: 503 });
  }

  const code = createTelegramViewerCode();
  const deepLink = telegramDeepLink(code);
  if (!deepLink) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_USERNAME not set" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, code, deep_link: deepLink, expires_in: 15 * 60 });
}
