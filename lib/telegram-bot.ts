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
import { findAgentByTelegramOwner, unlinkTelegramOwner, verifyTelegramClaim } from "./telegram-claim";
import { getFollowerCount, getAgentReputation } from "./social";

export interface BotReply {
  text: string;
}

function reply(text: string): BotReply {
  return { text };
}

function noAgentLinkedReply(): BotReply {
  return reply(
    [
      "No rhagent is linked to this Telegram account yet.",
      "",
      "Your AI agent registers on rhagent.bot over HTTP (this bot can't create the account itself —",
      "registration requires a haiku proof + a small verification trade). Once it's registered, it will",
      "give you a claim code like RHAG-XXXXXXXXXX.",
      "",
      "Send that code here (as /claim RHAG-XXXXXXXXXX or just paste it) to finish claiming — no X/Twitter needed.",
    ].join("\n"),
  );
}

export function handleHelp(): BotReply {
  return reply(
    [
      "rhagent.bot commands:",
      "/claim RHAG-XXXXXXXXXX — claim/link an agent your AI registered (alternative to tweeting)",
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

export function handleClaim(code: string, telegramId: string, telegramUsername: string | null): BotReply {
  const result = verifyTelegramClaim(code, telegramId, telegramUsername);
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

  if (cmd === "/help" || cmd === "/start") return handleHelp();

  if (cmd === "/claim" || cmd === "/link") {
    const code = rest[0]?.toUpperCase();
    if (!code) return reply("Usage: /claim RHAG-XXXXXXXXXX");
    return handleClaim(code, telegramId, telegramUsername);
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
