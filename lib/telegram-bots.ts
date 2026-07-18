/**
 * One Telegram bot for rhagent — verify/claim on the site + hosted agent (vault, skills, jobs).
 *
 * Deep links (login RHVIEW, link RHTG) open this bot. Webhook lives on rhagent-telegram-agent;
 * rhagentsite exposes /api/telegram/bridge for claim/link/viewer-verify.
 */

import { telegramDeepLink } from "@/lib/telegram";

/** Canonical @username (no @) for the single bot. */
export function telegramBotUsernameUnified(): string | null {
  const u =
    process.env.TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.NEXT_PUBLIC_TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    "";
  return u.length > 0 ? u : null;
}

/** @deprecated alias — same as telegramBotUsernameUnified */
export function siteTelegramBotUsername(): string | null {
  return telegramBotUsernameUnified();
}

/** @deprecated alias — same as telegramBotUsernameUnified */
export function tradingTelegramBotUsername(): string | null {
  return telegramBotUsernameUnified();
}

export function telegramDeepLinkUnified(startParam?: string): string | null {
  const username = telegramBotUsernameUnified();
  if (!username) return null;
  if (startParam) {
    return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}`;
}

export function tradingTelegramDeepLink(startParam?: string): string | null {
  return telegramDeepLinkUnified(startParam);
}

export function siteTelegramDeepLink(startParam: string): string | null {
  return telegramDeepLinkUnified(startParam) ?? telegramDeepLink(startParam);
}
