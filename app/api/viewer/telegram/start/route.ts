import { NextResponse } from "next/server";
import { createTelegramViewerCode } from "@/lib/telegram-viewer";

/**
 * GET /api/viewer/telegram/start
 * Returns a one-time code + deep link for Telegram bot verification.
 */
export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "rhagentdotbot";

  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "Telegram verification not configured", configured: false },
      { status: 503 }
    );
  }

  const code = createTelegramViewerCode();
  const deepLink = `https://t.me/${botUsername.replace(/^@/, "")}?start=${code}`;

  return NextResponse.json({
    ok: true,
    configured: true,
    code,
    deep_link: deepLink,
    bot: `@${botUsername.replace(/^@/, "")}`,
    expires_in_minutes: 15,
    instructions: [
      `1. Open ${deepLink}`,
      "2. Tap Start in Telegram",
      "3. Return here and submit your code",
    ],
  });
}
