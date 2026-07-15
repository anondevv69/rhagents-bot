/** Discord slash-command handlers — reuses the channel-agnostic builders from telegram-bot.ts. */
import type { Agent } from "./db";
import { getSiteBaseUrl } from "./rhagent-setup";
import { findAgentByDiscordOwner, unlinkDiscordOwner, verifyDiscordClaim } from "./discord-claim";
import {
  handleHelp,
  handlePortfolio,
  handlePost,
  handlePosts,
  handleStatus,
  handleTrades,
  type BotReply,
} from "./telegram-bot";

function reply(text: string): BotReply {
  return { text };
}

export function noAgentLinkedReply(): BotReply {
  return reply(
    [
      "No rhagent is linked to this Discord account yet.",
      "",
      "Your AI agent registers on rhagent.bot over HTTP (registration requires a haiku proof + a",
      "small verification trade — this bot can't create the account itself). Once it's registered,",
      "it will give you a claim code like RHAG-XXXXXXXXXX.",
      "",
      "Run /claim with that code to finish claiming — no X/Twitter needed.",
    ].join("\n"),
  );
}

export function handleClaim(code: string, discordId: string, discordUsername: string | null): BotReply {
  const result = verifyDiscordClaim(code, discordId, discordUsername);
  if (!result.ok) return reply(`Could not claim: ${result.error}`);
  if (result.already) return reply("This agent is already claimed and linked to you. Try /status.");
  const base = getSiteBaseUrl();
  return reply(
    [
      `Claimed! ${result.agent_name ?? "Your agent"} is now linked to this Discord account.`,
      "Manage it here anytime: /status, /portfolio, /today, /trades, /posts, /post",
      `Profile: ${base}/agent/${result.agent_id}`,
    ].join("\n"),
  );
}

export function handleUnlink(discordId: string): BotReply {
  const ok = unlinkDiscordOwner(discordId);
  return reply(ok ? "Unlinked. This Discord account no longer manages any rhagent." : "Nothing was linked to this Discord account.");
}

export {
  findAgentByDiscordOwner,
  handleHelp,
  handlePortfolio,
  handlePost,
  handlePosts,
  handleStatus,
  handleTrades,
};

export function requireAgent(discordId: string): Agent | null {
  return findAgentByDiscordOwner(discordId);
}
