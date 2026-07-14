import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramWebhookSecret, sendTelegramMessage, type TelegramUpdate } from "@/lib/telegram";
import { markTelegramVerified, parseTelegramStartPayload } from "@/lib/telegram-viewer";
import { parseClaimCodeFromText, findAgentByTelegramOwner } from "@/lib/telegram-claim";
import { routeCommand } from "@/lib/telegram-bot";
import { routeNaturalLanguage } from "@/lib/telegram-nl";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/telegram/webhook
 *
 * Single webhook for the whole rhagent.bot Telegram bot:
 *  - /start RHVIEW-XXXXXXXXXX  → web "log in with Telegram" handshake (lib/telegram-viewer.ts)
 *  - /claim RHAG-XXXXXXXXXX    → claim/link an agent (alternative to X tweet claim)
 *  - /status /trades /posts /post /unlink /help → account management commands
 *  - anything else             → natural-language router (Claude tool-use), if configured
 *
 * Always returns 200 quickly — Telegram retries aggressively on non-2xx.
 */
export async function POST(req: NextRequest) {
  if (!verifyTelegramWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const text = msg?.text?.trim();
  const chatId = msg?.chat?.id;
  const from = msg?.from;

  if (!text || !chatId || !from || from.is_bot) {
    return NextResponse.json({ ok: true });
  }

  // 20 messages / minute / Telegram user — enough for normal chat, blocks spam loops.
  if (!rateLimit(`tg-webhook:${from.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ ok: true });
  }

  const telegramId = String(from.id);
  const telegramUsername = from.username ?? null;

  void handleMessage(text, chatId, telegramId, telegramUsername).catch((err) => {
    console.error("[telegram/webhook] handler failed", err);
  });

  return NextResponse.json({ ok: true });
}

async function handleMessage(
  text: string,
  chatId: number,
  telegramId: string,
  telegramUsername: string | null,
): Promise<void> {
  const viewerCode = parseTelegramStartPayload(text);
  if (viewerCode) {
    const ok = markTelegramVerified(viewerCode, telegramId, telegramUsername);
    await sendTelegramMessage(
      chatId,
      ok
        ? "Verified! Go back to the rhagent.bot tab you opened this from — it should log you in within a few seconds."
        : "That login link expired or was already used. Go back to rhagent.bot and tap \u201cLog in with Telegram\u201d again.",
    );
    return;
  }

  if (text.startsWith("/")) {
    const out = routeCommand(text, telegramId, telegramUsername);
    await sendTelegramMessage(chatId, out.text);
    return;
  }

  // Bare claim code with no leading slash — still honor it.
  const bareCode = parseClaimCodeFromText(text);
  if (bareCode && /^RHAG-[A-F0-9]{10}$/i.test(text.trim())) {
    const out = routeCommand(`/claim ${bareCode}`, telegramId, telegramUsername);
    await sendTelegramMessage(chatId, out.text);
    return;
  }

  const agent = findAgentByTelegramOwner(telegramId);
  const out = await routeNaturalLanguage(text, agent, telegramId, telegramUsername);
  await sendTelegramMessage(chatId, out);
}
