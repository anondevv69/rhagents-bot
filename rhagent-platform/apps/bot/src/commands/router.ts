/**
 * Command router — maps user input to handlers.
 * Platform-agnostic: receives a normalized message, returns a response.
 */

import type { Platform, User } from "@rhagent/shared";
import { BankrClient } from "@rhagent/shared";
import { handleStart } from "../onboarding/flow.js";
import { messages } from "../onboarding/messages.js";
import { findOrCreateUser, getManagedMessagesUsed } from "../db/users.js";
import { getSecret, setSecret, hasSecret } from "../db/vault.js";
import { env } from "../env.js";

const bankr = new BankrClient({
  partnerKey: env.bankrPartnerKey,
  starterCreditUsd: env.bankrStarterCreditUsd,
  fundEth: env.bankrFundEth || undefined,
});

export interface BotMessage {
  platform: Platform;
  platformId: string;
  chatId: string;
  text: string;
  username?: string;
  displayName?: string;
}

export interface BotResponse {
  text: string;
  buttons?: Array<{ label: string; action: string }>;
}

/**
 * Main entry point — every message from every platform hits this.
 */
export async function handleMessage(msg: BotMessage): Promise<BotResponse> {
  const text = msg.text.trim();

  // Commands
  if (text.startsWith("/")) {
    return handleCommand(msg, text);
  }

  // Callback data from buttons
  if (text.startsWith("onboard:") || text.startsWith("cmd:")) {
    return handleCallback(msg, text);
  }

  // Free-form chat
  return handleChat(msg, text);
}

async function handleCommand(msg: BotMessage, text: string): Promise<BotResponse> {
  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase();

  switch (command) {
    case "/start":
      return handleStart(msg.platform, msg.platformId, {
        username: msg.username,
        displayName: msg.displayName,
      });

    case "/help":
      return { text: messages.help(env.brandName) };

    case "/status":
      return handleStatus(msg);

    case "/credits":
      return handleCredits(msg);

    case "/buy_credits":
      return handleBuyCredits(msg, args);

    case "/setkey":
      return handleSetKey(msg, args);

    case "/connect":
      return {
        text: `Connect your accounts at:\n${env.dashboardUrl}/dashboard?tab=connections`,
        buttons: [
          { label: "Open Dashboard", action: `url:${env.dashboardUrl}/dashboard?tab=connections` },
        ],
      };

    case "/trading":
      return {
        text: `Trading dashboard:\n${env.dashboardUrl}/dashboard?tab=trading`,
        buttons: [
          { label: "Open Trading", action: `url:${env.dashboardUrl}/dashboard?tab=trading` },
        ],
      };

    case "/settings":
      return {
        text: `Settings:\n${env.dashboardUrl}/dashboard?tab=settings`,
        buttons: [
          { label: "Open Settings", action: `url:${env.dashboardUrl}/dashboard?tab=settings` },
        ],
      };

    case "/wipe":
      return {
        text: "This will reset your account. Are you sure?",
        buttons: [
          { label: "Yes, reset everything", action: "cmd:wipe_confirm" },
          { label: "Cancel", action: "cmd:cancel" },
        ],
      };

    default:
      return { text: `Unknown command: ${command}\nTry /help for available commands.` };
  }
}

async function handleCallback(msg: BotMessage, action: string): Promise<BotResponse> {
  switch (action) {
    case "onboard:connect_rh":
      return {
        text: messages.connectRobinhood(env.dashboardUrl),
        buttons: [
          { label: "Connect Crypto", action: `url:${env.dashboardUrl}/dashboard?tab=connections&connect=crypto` },
          { label: "Connect Agentic", action: `url:${env.dashboardUrl}/dashboard?tab=connections&connect=agentic` },
          { label: "Skip for now", action: "onboard:skip_rh" },
        ],
      };

    case "onboard:skip_rh":
      return {
        text: "No problem. You can connect Robinhood anytime from /connect or the dashboard.\n\nGo ahead and ask me anything.",
      };

    case "onboard:explore":
      return { text: messages.explore(env.brandName) };

    case "cmd:status":
      return handleStatus(msg);

    case "cmd:cancel":
      return { text: "Cancelled." };

    default:
      return { text: "Unknown action." };
  }
}

// ─── Command Handlers ───

async function handleStatus(msg: BotMessage): Promise<BotResponse> {
  const user = findOrCreateUser(msg.platform, msg.platformId);
  const apiKey = getSecret(user.id, "bankr_api_key");
  const credits = apiKey ? await bankr.getLlmCredits(apiKey) : null;
  const managedLeft = Math.max(0, env.managedInferenceMessages - getManagedMessagesUsed(user.id));
  const engine = resolveEngine(user.id, managedLeft);

  return { text: messages.status(user, credits ? { balance: credits.effectiveBalanceUsd } : null, managedLeft, engine) };
}

async function handleCredits(msg: BotMessage): Promise<BotResponse> {
  const user = findOrCreateUser(msg.platform, msg.platformId);
  const apiKey = getSecret(user.id, "bankr_api_key");
  const credits = apiKey ? await bankr.getLlmCredits(apiKey) : null;
  const managedLeft = Math.max(0, env.managedInferenceMessages - getManagedMessagesUsed(user.id));

  return { text: messages.credits(managedLeft, credits?.effectiveBalanceUsd ?? null) };
}

async function handleBuyCredits(msg: BotMessage, args: string[]): Promise<BotResponse> {
  const amount = parseFloat(args[0] || "");
  if (!amount || amount <= 0) {
    return { text: "Usage: /buy_credits <amount>\nExample: /buy_credits 5" };
  }

  const user = findOrCreateUser(msg.platform, msg.platformId);
  const apiKey = getSecret(user.id, "bankr_api_key");
  if (!apiKey) {
    return { text: "No wallet found. Run /start to set up your account." };
  }

  const result = await bankr.buyLlmCredits(apiKey, amount, "USDC");
  if (result.ok) {
    return { text: `Converted ${amount} USDC → LLM credits. Check balance with /credits.` };
  }
  return { text: `Could not buy credits: ${result.error}\n\nMake sure you have USDC in your wallet.` };
}

async function handleSetKey(msg: BotMessage, args: string[]): Promise<BotResponse> {
  if (args.length < 2) {
    return { text: "Usage: /setkey <provider> <api_key>\nProviders: anthropic, openai, grok" };
  }

  const provider = args[0].toLowerCase();
  if (!["anthropic", "openai", "grok"].includes(provider)) {
    return { text: "Supported providers: anthropic, openai, grok" };
  }

  const key = args.slice(1).join(" ").trim();
  if (!looksLikeApiKey(key)) {
    return { text: messages.invalidApiKey(provider, key.length) };
  }

  const user = findOrCreateUser(msg.platform, msg.platformId);
  const secretKey =
    provider === "anthropic" ? "llm_anthropic_key" : provider === "openai" ? "llm_openai_key" : "llm_grok_key";
  setSecret(user.id, secretKey, key);

  return { text: `${provider} API key saved. Your chats will now use your own key.` };
}

// ─── Chat ───

async function handleChat(msg: BotMessage, text: string): Promise<BotResponse> {
  const user = findOrCreateUser(msg.platform, msg.platformId, {
    username: msg.username,
    displayName: msg.displayName,
  });

  // If onboarding not complete, run them through it first
  if (user.onboardingStep === "welcome") {
    return handleStart(msg.platform, msg.platformId, {
      username: msg.username,
      displayName: msg.displayName,
    });
  }

  const managedLeft = Math.max(0, env.managedInferenceMessages - getManagedMessagesUsed(user.id));
  const engine = resolveEngine(user.id, managedLeft);

  if (engine === "blocked") {
    return { text: messages.blocked() };
  }

  // TODO: Wire to actual LLM agent loop (managed / bankr / byok)
  // For now, return a placeholder that shows the engine routing works
  return {
    text: `[${engine} engine] I received your message. Full agent loop coming soon.\n\nUse /help to see available commands.`,
  };
}

// ─── Helpers ───

function resolveEngine(userId: string, managedLeft: number): string {
  // BYOK first
  if (hasSecret(userId, "llm_anthropic_key") || hasSecret(userId, "llm_openai_key") || hasSecret(userId, "llm_grok_key")) {
    return "byok";
  }
  // Managed starter pool
  if (managedLeft > 0 && env.fallbackAnthropicApiKey) {
    return "managed";
  }
  // Bankr agent
  if (hasSecret(userId, "bankr_api_key")) {
    return "bankr";
  }
  return "blocked";
}

function looksLikeApiKey(value: string): boolean {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return false;
  if (trimmed.length < 20 || trimmed.length > 200) return false;
  if (!/^[A-Za-z0-9_\-.]+$/.test(trimmed)) return false;
  return true;
}
