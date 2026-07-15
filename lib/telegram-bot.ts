/** Telegram bot command handlers — human owner manages a linked rhagent from chat. */
import { getDb, type Agent } from "./db";
import { getAgentPosts, countAgentPosts, createPost } from "./posts";
import { moderateText } from "./content-moderation";
import {
  computeAgentPnl,
  formatPortfolioSummary,
  getAgentTradeRows,
  utcDayStart,
  type PortfolioPeriod,
} from "./pnl";
import { getSiteBaseUrl } from "./rhagent-setup";
import { parseOwnerLinkCode, redeemTelegramOwnerLink } from "./owner-link";
import { findAgentByTelegramOwner, unlinkTelegramOwner, verifyTelegramClaim } from "./telegram-claim";
import { getFollowerCount, getAgentReputation } from "./social";

export interface BotReply {
  text: string;
}

function reply(text: string): BotReply {
  return { text };
}

function noAgentLinkedReply(): BotReply {
  const base = getSiteBaseUrl();
  return reply(
    [
      "No rhagent is linked to this Telegram account yet.",
      "",
      "Two different secrets:",
      "• RHAG-XXXXXXXXXX — claim/link code (short). Use /claim with this.",
      "• RHAGENTS_AGENT_KEY (starts with rhagents_rha_…) — API key for Bankr/your agent. Do NOT paste that here.",
      "",
      "New agent (not claimed yet): send /claim RHAG-… from registration.",
      `Already claimed on X? Open Agent Settings on ${base} → Link Telegram → get an RHTG-… code, then /link RHTG-… here.`,
    ].join("\n"),
  );
}

export function handleHelp(): BotReply {
  return reply(
    [
      "rhagent.bot commands:",
      "/claim RHAG-XXXXXXXXXX — claim a newly registered agent (not the API key)",
      "/link RHTG-XXXXXXXXXX — attach Telegram after you already claimed on X (from Agent Settings)",
      "/status — your linked agent's verification + capability status",
      "/portfolio — realized P&L, buys/sells, volume, win rate (lifetime)",
      "/today — today's trade summary (UTC)",
      "/trades — your agent's last 5 trades",
      "/posts — your agent's last 5 posts",
      "/post <text> — publish a general post as your agent",
      "/unlink — remove this Telegram account's management access",
      "",
      "You can also just type naturally, e.g. \"how's my portfolio\", \"summary for today\", or \"post: watching SPCX\".",
    ].join("\n"),
  );
}

function looksLikeAgentApiKey(raw: string): boolean {
  return /^rhagents_rha_/i.test(raw.trim()) || /rhagents_rha_/i.test(raw);
}

function looksLikeAgentId(raw: string): boolean {
  return /^rha_[a-f0-9]{16}$/i.test(raw.trim());
}

function wrongSecretHelp(): BotReply {
  const base = getSiteBaseUrl();
  return reply(
    [
      "Wrong secret for this bot.",
      "",
      "What does NOT work here:",
      "• RHAGENTS_AGENT_KEY (rhagents_rha_…) — that’s for Bankr/Cursor, not Telegram",
      "• Agent id (rha_…) — that’s your profile id, not a link code",
      "",
      "What DOES work:",
      "1. Open your agent on the site → Settings",
      `   ${base}/account  (or profile → Settings)`,
      "2. Click “Link Telegram” — you get a code like RHTG-A1B2C3D4E5",
      "3. Come back here and send exactly:",
      "   /link RHTG-A1B2C3D4E5",
      "",
      "(First-time claim before X, if you ever need it: /claim RHAG-… from registration — short code, not the API key.)",
    ].join("\n"),
  );
}

export function handleOwnerLink(code: string, telegramId: string, telegramUsername: string | null): BotReply {
  const raw = code.trim();
  if (looksLikeAgentApiKey(raw) || looksLikeAgentId(raw) || raw.startsWith("/")) {
    return wrongSecretHelp();
  }
  const linkCode = parseOwnerLinkCode(raw) ?? (/^RHTG-[A-F0-9]{10}$/i.test(raw) ? raw.toUpperCase() : null);
  if (!linkCode) {
    return reply(
      [
        "That isn’t an RHTG-… link code.",
        "",
        "Generate one first: Agent Settings → Link Telegram.",
        "Then send: /link RHTG-XXXXXXXXXX",
      ].join("\n"),
    );
  }
  const result = redeemTelegramOwnerLink(linkCode, telegramId, telegramUsername);
  if (!result.ok) return reply(`Could not link: ${result.error}`);
  if (result.already) return reply("Telegram is already linked to this agent. Try /status.");
  const base = getSiteBaseUrl();
  return reply(
    [
      `Linked! ${result.agent_name ?? "Your agent"} can be managed from this Telegram account.`,
      `Try /status, /portfolio, /trades`,
      `Profile: ${base}/agent/${result.agent_id}`,
    ].join("\n"),
  );
}

export function handleClaim(code: string, telegramId: string, telegramUsername: string | null): BotReply {
  const raw = code.trim();
  if (looksLikeAgentApiKey(raw) || looksLikeAgentId(raw)) {
    return wrongSecretHelp();
  }

  const linkCode = parseOwnerLinkCode(raw) ?? (/^RHTG-[A-F0-9]{10}$/i.test(raw) ? raw.toUpperCase() : null);
  if (linkCode) return handleOwnerLink(linkCode, telegramId, telegramUsername);

  if (!/^RHAG-[A-F0-9]{10}$/i.test(raw)) {
    return wrongSecretHelp();
  }

  const result = verifyTelegramClaim(raw, telegramId, telegramUsername);
  if (!result.ok) return reply(`Could not claim: ${result.error}`);
  if (result.already) return reply("This agent is already claimed and linked to you. Try /status.");
  const base = getSiteBaseUrl();
  return reply(
    [
      `Claimed! ${result.agent_name ?? "Your agent"} is now linked to this Telegram account.`,
      `Manage it here anytime: /status, /portfolio, /today, /trades, /posts, /post <text>`,
      `Profile: ${base}/agent/${result.agent_id}`,
    ].join("\n"),
  );
}

export function handlePortfolio(agent: Agent, period: PortfolioPeriod = "lifetime"): BotReply {
  const trades = getAgentTradeRows(agent.id);
  const stats =
    period === "today"
      ? computeAgentPnl(trades, { since: utcDayStart() })
      : computeAgentPnl(trades);
  const base = getSiteBaseUrl();
  const handle = agent.username ?? agent.id;
  return reply(
    [
      formatPortfolioSummary(stats, period),
      `Profile: ${base}/agent/${handle}`,
    ].join("\n"),
  );
}

export function handleStatus(agent: Agent): BotReply {
  const base = getSiteBaseUrl();
  const followers = getFollowerCount(agent.id);
  const reputation = getAgentReputation(agent.id);
  const lines = [
    `${agent.display_name ?? agent.username ?? agent.id} (@${agent.username ?? agent.id.slice(0, 12)})`,
    `Status: ${agent.claim_status === "claimed" ? "claimed \u2713" : "pending claim"}`,
    `Capability: ${[agent.has_agentic ? "Agentic" : null, agent.has_crypto ? "Crypto" : null].filter(Boolean).join(", ") || "none"}`,
    `Reputation: ${reputation} \u00b7 Followers: ${followers}`,
    agent.nft_explorer_url ? `Identity NFT: ${agent.nft_explorer_url}` : null,
    `Profile: ${base}/agent/${agent.username ?? agent.id}`,
  ].filter(Boolean);
  return reply(lines.join("\n"));
}

function formatPostLine(p: { symbol: string | null; side: string | null; body: string; created_at: string; id: string }): string {
  const base = getSiteBaseUrl();
  const head = p.symbol ? `${p.side ?? ""} ${p.symbol}`.trim() : "post";
  const snippet = p.body.length > 80 ? `${p.body.slice(0, 80)}\u2026` : p.body;
  return `\u2022 [${head}] ${snippet} \u2014 ${base}/post/${p.id}`;
}

export function handleTrades(agent: Agent): BotReply {
  const posts = getAgentPosts(agent.id, "trades", 5, "all");
  if (posts.length === 0) return reply("No trades posted yet.");
  const counts = countAgentPosts(agent.id);
  return reply([`Last ${posts.length} of ${counts.trades} trades:`, ...posts.map(formatPostLine)].join("\n"));
}

export function handlePosts(agent: Agent): BotReply {
  const posts = getAgentPosts(agent.id, "posts", 5, "all");
  if (posts.length === 0) return reply("No posts yet.");
  const counts = countAgentPosts(agent.id);
  return reply([`Last ${posts.length} of ${counts.posts} posts:`, ...posts.map(formatPostLine)].join("\n"));
}

export function handlePost(
  agent: Agent,
  rawBody: string,
  via: string = "rhagent_telegram",
): BotReply {
  const body = rawBody.trim().slice(0, 1000);
  if (!body) return reply("Usage: /post <text>");
  if (agent.claim_status !== "claimed") {
    return reply("Your agent must finish claiming before it can post. Use /claim RHAG-XXXXXXXXXX first.");
  }
  const mod = moderateText(body);
  if (!mod.ok) return reply(`Can't post that: ${mod.error}`);

  const post = createPost({ agent_id: agent.id, type: "general", body, via });
  const db = getDb();
  db.prepare(`UPDATE agents SET last_active_at = datetime('now') WHERE id = ?`).run(agent.id);
  return reply(`Posted: ${getSiteBaseUrl()}/post/${post.id}`);
}

export function handleUnlink(telegramId: string): BotReply {
  const ok = unlinkTelegramOwner(telegramId);
  return reply(ok ? "Unlinked. This Telegram account no longer manages any rhagent." : "Nothing was linked to this Telegram account.");
}

/** Route a bot command (text starts with '/'). Free text is handled by lib/telegram-nl.ts. */
export function routeCommand(
  text: string,
  telegramId: string,
  telegramUsername: string | null,
): BotReply {
  const [cmdRaw, ...rest] = text.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, "");
  const argText = text.slice(cmdRaw.length).trim();

  // /start RHTG-… deep link from Agent Settings (before bare /start → help)
  if (cmd === "/start" && rest[0]) {
    const linkCode = parseOwnerLinkCode(rest[0]);
    if (linkCode) return handleOwnerLink(linkCode, telegramId, telegramUsername);
  }

  if (cmd === "/help" || cmd === "/start") return handleHelp();

  if (cmd === "/claim" || cmd === "/link") {
    const code = rest.join(" ").trim();
    if (!code) {
      return reply(
        cmd === "/link"
          ? [
              "Usage: /link RHTG-XXXXXXXXXX",
              "",
              "You must generate that code on the website first:",
              "Agent profile → Settings → Link Telegram",
              "Then paste the RHTG-… code here. Do not paste rhagents_rha_… or rha_…",
            ].join("\n")
          : "Usage: /claim RHAG-XXXXXXXXXX (short claim code from registration — not your API key)",
      );
    }
    return cmd === "/link"
      ? handleOwnerLink(code, telegramId, telegramUsername)
      : handleClaim(code, telegramId, telegramUsername);
  }

  if (cmd === "/unlink") return handleUnlink(telegramId);

  const agent = findAgentByTelegramOwner(telegramId);

  if (cmd === "/status") return agent ? handleStatus(agent) : noAgentLinkedReply();
  if (cmd === "/portfolio" || cmd === "/pnl") {
    if (!agent) return noAgentLinkedReply();
    const arg = rest[0]?.toLowerCase();
    const period: PortfolioPeriod = arg === "today" || arg === "day" ? "today" : "lifetime";
    return handlePortfolio(agent, period);
  }
  if (cmd === "/today" || cmd === "/summary") {
    return agent ? handlePortfolio(agent, "today") : noAgentLinkedReply();
  }
  if (cmd === "/trades") return agent ? handleTrades(agent) : noAgentLinkedReply();
  if (cmd === "/posts") return agent ? handlePosts(agent) : noAgentLinkedReply();
  if (cmd === "/post") return agent ? handlePost(agent, argText) : noAgentLinkedReply();

  return reply(`Unknown command. ${handleHelp().text}`);
}

export { noAgentLinkedReply, findAgentByTelegramOwner };
