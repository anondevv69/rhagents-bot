import { timingSafeEqual } from "crypto";

/** Raw Telegram Bot API client — no SDK, same style as lib/claim.ts Twitter calls. */

function botToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t && t.length > 10 ? t : null;
}

export function telegramConfigured(): boolean {
  return !!botToken();
}

export function telegramBotUsername(): string | null {
  // One bot: prefer trading/agent username, then legacy site username.
  const u =
    process.env.TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.NEXT_PUBLIC_TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    "";
  return u.length > 0 ? u : null;
}

export function telegramDeepLink(startParam: string): string | null {
  const username = telegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
}

/** Verify the `X-Telegram-Bot-Api-Secret-Token` header Telegram sends on webhook calls. */
export function verifyTelegramWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (!headerValue) return false;
  try {
    const a = Buffer.from(headerValue);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  };
}

/** Escape for Telegram MarkdownV2 — only the characters that break parsing. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  opts: { disablePreview?: boolean } = {},
): Promise<boolean> {
  const token = botToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        disable_web_page_preview: opts.disablePreview ?? true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram] sendMessage failed", err);
    return false;
  }
}

/** One-time setup call — see scripts/telegram-set-webhook.ts. */
export async function setTelegramWebhook(url: string, secretToken: string): Promise<unknown> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: secretToken, allowed_updates: ["message"] }),
  });
  return res.json();
}
