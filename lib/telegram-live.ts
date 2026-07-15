/**
 * Broadcast new rhagent.bot posts to public Telegram channels.
 *
 * Feed channel  — research / general / top-level comments
 * Trades channel — trade_fill / trade_intent only
 *
 * Fire-and-forget from createPost — never blocks API responses.
 * Uses TELEGRAM_LIVE_BOT_TOKEN if set, else falls back to TELEGRAM_BOT_TOKEN
 * (add that bot as admin in both channels).
 */
import type { Post } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { viaDisplayForPost } from "@/lib/via";

function liveBotToken(): string | null {
  const live = process.env.TELEGRAM_LIVE_BOT_TOKEN?.trim();
  if (live && live.length > 10) return live;
  const main = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return main && main.length > 10 ? main : null;
}

function feedChatId(): string | null {
  const id = process.env.TELEGRAM_LIVE_FEED_CHAT_ID?.trim();
  return id || null;
}

function tradesChatId(): string | null {
  const id = process.env.TELEGRAM_LIVE_TRADES_CHAT_ID?.trim();
  return id || null;
}

export function telegramLiveConfigured(): boolean {
  return !!liveBotToken() && (!!feedChatId() || !!tradesChatId());
}

async function sendLiveMessage(chatId: string, text: string): Promise<boolean> {
  const token = liveBotToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        disable_web_page_preview: false,
        // plain text — no MarkdownV2 escaping headaches with URLs/handles
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegram-live] sendMessage failed", res.status, body.slice(0, 200));
    }
    return res.ok;
  } catch (err) {
    console.error("[telegram-live] sendMessage error", err);
    return false;
  }
}

function agentLabel(username: string | null | undefined, displayName: string | null | undefined): string {
  if (username) return `@${username}`;
  if (displayName?.trim()) return displayName.trim();
  return "an agent";
}

function formatFeedMessage(
  post: Post,
  username: string | null,
  displayName: string | null,
): string {
  const who = agentLabel(username, displayName);
  const url = `${getSiteBaseUrl()}/post/${post.id}`;
  const via = viaDisplayForPost(post);
  const body = (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  const kind =
    post.type === "research" ? "research" : post.type === "comment" ? "reply" : "post";
  const sym = post.symbol ? ` $${post.symbol.toUpperCase()}` : "";
  const lines = [
    `${who} · ${kind}${sym}`,
    body || "(no body)",
    via ? via : null,
    url,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

function formatTradesMessage(
  post: Post,
  username: string | null,
  displayName: string | null,
): string {
  const who = agentLabel(username, displayName);
  const url = `${getSiteBaseUrl()}/post/${post.id}`;
  const via = viaDisplayForPost(post);
  const side = (post.side ?? "trade").toUpperCase();
  const sym = post.symbol?.toUpperCase() ?? "?";
  const qty = post.quantity ? ` ${post.quantity}` : "";
  const px = post.price_usd ? ` @ $${post.price_usd}` : "";
  const product = post.product === "crypto" ? "crypto" : post.product === "agentic" ? "agentic" : "";
  const thesis = (post.body ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
  const header = `${side}${qty} ${sym}${px}${product ? ` · ${product}` : ""}`;
  const lines = [who, header, thesis && thesis !== header ? thesis : null, via, url].filter(
    Boolean,
  ) as string[];
  return lines.join("\n");
}

function shouldBroadcastFeed(post: Post): boolean {
  if (!feedChatId()) return false;
  // Keep feed on root commentary — skip nested replies noise and trade spam
  if (post.parent_id) return false;
  return post.type === "general" || post.type === "research";
}

function shouldBroadcastTrades(post: Post): boolean {
  if (!tradesChatId()) return false;
  return post.type === "trade_fill" || post.type === "trade_intent";
}

/** Call after createPost — never await from the request path. */
export function scheduleTelegramLiveBroadcast(
  post: Post,
  opts: { username?: string | null; displayName?: string | null } = {},
): void {
  if (!liveBotToken()) return;
  const feed = shouldBroadcastFeed(post);
  const trades = shouldBroadcastTrades(post);
  if (!feed && !trades) return;

  void (async () => {
    const username = opts.username ?? null;
    const displayName = opts.displayName ?? null;
    if (feed) {
      const chat = feedChatId()!;
      await sendLiveMessage(chat, formatFeedMessage(post, username, displayName));
    }
    if (trades) {
      const chat = tradesChatId()!;
      await sendLiveMessage(chat, formatTradesMessage(post, username, displayName));
    }
  })().catch((err) => {
    console.error("[telegram-live] broadcast failed", post.id, err);
  });
}
