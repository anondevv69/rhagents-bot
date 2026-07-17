/**
 * Two Telegram bots — do not conflate them in UI or deep links.
 *
 * 1) Site bot (TELEGRAM_BOT_*) — rhagentsite webhook: /claim, /link RHTG-…,
 *    /status, /portfolio, /trades, /posts. No Robinhood keys, no /website.
 *
 * 2) Trading bot (TRADING_TELEGRAM_BOT_USERNAME) — rhagent-telegram-agent:
 *    /website dashboard, /connect_crypto, /connect_agentic, vault + jobs.
 */

import { telegramBotUsername, telegramDeepLink } from "@/lib/telegram";

export type TelegramBotKind = "site" | "trading";

export function siteTelegramBotUsername(): string | null {
  return telegramBotUsername();
}

/** @username of the trading agent bot (has /website). */
export function tradingTelegramBotUsername(): string | null {
  const u =
    process.env.TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    process.env.NEXT_PUBLIC_TRADING_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ||
    "";
  return u.length > 0 ? u : null;
}

export function tradingTelegramDeepLink(startParam?: string): string | null {
  const username = tradingTelegramBotUsername();
  if (!username) return null;
  if (startParam) {
    return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}`;
}

export function siteTelegramDeepLink(startParam: string): string | null {
  return telegramDeepLink(startParam);
}

export function telegramBotsPublicConfig(): {
  site: { username: string | null; deep_link: string | null; purpose: string };
  trading: { username: string | null; deep_link: string | null; purpose: string };
} {
  const siteUser = siteTelegramBotUsername();
  const tradingUser = tradingTelegramBotUsername();
  return {
    site: {
      username: siteUser,
      deep_link: siteUser ? `https://t.me/${siteUser}` : null,
      purpose: "Claim/link your rhagent.bot profile (/claim, /link). Portfolio & posts from chat.",
    },
    trading: {
      username: tradingUser,
      deep_link: tradingTelegramDeepLink(),
      purpose: "Robinhood trading vault + /website dashboard (Crypto / Agentic).",
    },
  };
}
