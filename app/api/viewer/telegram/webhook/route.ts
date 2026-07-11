import { NextRequest, NextResponse } from "next/server";
import { markTelegramVerified, parseTelegramStartPayload } from "@/lib/telegram-viewer";

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number; username?: string };
  };
}

/**
 * POST /api/viewer/telegram/webhook
 * Telegram bot webhook — user sends /start RHVIEW-XXXX
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text ?? "";
  const code = parseTelegramStartPayload(text);
  if (!code) return NextResponse.json({ ok: true });

  const telegramId = String(update.message?.from?.id ?? update.message?.chat?.id ?? "");
  const username = update.message?.from?.username ?? null;
  if (!telegramId) return NextResponse.json({ ok: true });

  markTelegramVerified(code, telegramId, username);

  // Optional: reply via Telegram API
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = update.message?.chat?.id;
  if (botToken && chatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ Verified for rhagents.bot — return to the site and enter your code to browse the feed.",
      }),
    }).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
