/**
 * One-time setup: point the Telegram bot's webhook at this deployment.
 *
 * Usage (from a shell that has the production env vars, or after `set -a; source .env`):
 *   npm run telegram:set-webhook
 *
 * Requires: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL
 */
import { setTelegramWebhook } from "../lib/telegram";

async function main() {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!base) throw new Error("NEXT_PUBLIC_BASE_URL not set");
  if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET not set");
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const url = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
  console.log(`Setting Telegram webhook -> ${url}`);
  const result = await setTelegramWebhook(url, secret);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
