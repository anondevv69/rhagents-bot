/**
 * Telegram bot adapter — maps Telegraf events to the platform-agnostic router.
 */
import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { handleMessage, type BotResponse } from "../commands/router.js";
import { env } from "../env.js";

export function createTelegramBot(): Telegraf {
  const bot = new Telegraf(env.telegramBotToken);

  // ─── Commands ───

  bot.command("start", (ctx) => route(ctx, "/start"));
  bot.command("help", (ctx) => route(ctx, "/help"));
  bot.command("status", (ctx) => route(ctx, "/status"));
  bot.command("credits", (ctx) => route(ctx, "/credits"));
  bot.command("buy_credits", (ctx) => route(ctx, `/buy_credits ${ctx.message.text.split(/\s+/).slice(1).join(" ")}`));
  bot.command("setkey", (ctx) => route(ctx, `/setkey ${ctx.message.text.split(/\s+/).slice(1).join(" ")}`));
  bot.command("connect", (ctx) => route(ctx, "/connect"));
  bot.command("trading", (ctx) => route(ctx, "/trading"));
  bot.command("settings", (ctx) => route(ctx, "/settings"));
  bot.command("wipe", (ctx) => route(ctx, "/wipe"));

  // ─── Callback queries (button presses) ───

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    if (!data) return;

    // URL actions — just acknowledge, Telegram opens the URL
    if (data.startsWith("url:")) {
      await ctx.answerCbQuery();
      return;
    }

    await ctx.answerCbQuery();
    await route(ctx, data);
  });

  // ─── Free-form text ───

  bot.on("text", (ctx) => route(ctx, ctx.message.text));

  // ─── Error handling ───

  bot.catch((err, ctx) => {
    console.error("[telegram] Unhandled error:", err);
    ctx.reply("Something went wrong. Try again or /help.").catch(() => undefined);
  });

  return bot;
}

async function route(ctx: Context, text: string): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  const response = await handleMessage({
    platform: "telegram",
    platformId: String(from.id),
    chatId: String(ctx.chat?.id ?? from.id),
    text,
    username: from.username,
    displayName: [from.first_name, from.last_name].filter(Boolean).join(" ") || undefined,
  });

  await sendTelegramResponse(ctx, response);
}

async function sendTelegramResponse(ctx: Context, response: BotResponse): Promise<void> {
  const { text, buttons } = response;

  if (!buttons?.length) {
    await ctx.reply(text, { parse_mode: "Markdown" }).catch(() =>
      // Fallback without Markdown if it fails
      ctx.reply(text),
    );
    return;
  }

  // Build inline keyboard
  const keyboard = buttons.map((btn) => {
    if (btn.action.startsWith("url:")) {
      return [Markup.button.url(btn.label, btn.action.slice(4))];
    }
    return [Markup.button.callback(btn.label, btn.action)];
  });

  await ctx
    .reply(text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(keyboard),
    })
    .catch(() =>
      ctx.reply(text, Markup.inlineKeyboard(keyboard)),
    );
}
