/**
 * All user-facing copy in one place. Clean, concise, non-overwhelming.
 * Every message fits on a phone screen without scrolling.
 */

import type { User } from "@rhagent/shared";

export const messages = {
  /** First-ever /start — wallet provisioned in background. */
  welcome(user: User, brand: string, dashUrl: string, walletError?: string | null): string {
    const name = user.displayName || user.username || "there";
    const lines = [
      `Hey ${name}, welcome to ${brand}.`,
      "",
      "You're ready to go. I've set up your account with:",
      `  Wallet: ${user.walletAddress ? `\`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-4)}\`` : walletError ? "setup pending" : "provisioning..."}`,
      `  Free messages: 25 starter chats included`,
      `  LLM credits: $5 starter credit loading`,
      "",
      "You can chat with me right now about anything — markets, research, analysis.",
      "",
      "When you're ready to trade, connect your Robinhood account.",
    ];
    return lines.join("\n");
  },

  /** Returning user who's already onboarded. */
  welcomeBack(user: User, brand: string): string {
    const name = user.displayName || user.username || "there";
    return `Welcome back, ${name}. What can I help with?`;
  },

  /** Robinhood connect step. */
  connectRobinhood(dashUrl: string): string {
    return [
      "Connect your Robinhood account to start trading.",
      "",
      "Two connections available:",
      "  Crypto — buy/sell crypto directly",
      "  Agentic — access Robinhood's AI trading features",
      "",
      "Both are optional. Connect one or both from the dashboard.",
    ].join("\n");
  },

  /** Wallet confirmed working. */
  walletReady(user: User, starterMessages: number): string {
    return [
      "You're all set up.",
      "",
      `  ${starterMessages} free chat messages`,
      "  $5 LLM credit for advanced AI features",
      user.walletAddress ? `  Wallet: \`${user.walletAddress.slice(0, 8)}...${user.walletAddress.slice(-4)}\`` : "",
      "",
      "Try asking me something — a market question, research request, or anything else.",
    ]
      .filter(Boolean)
      .join("\n");
  },

  /** Show what they can do. */
  explore(brand: string): string {
    return [
      "Here's what I can do:",
      "",
      "Chat & Research",
      '  Just type naturally — "What\'s happening with ETH?" or "Analyze AAPL earnings"',
      "",
      "Trading (requires Robinhood connection)",
      '  "Buy $50 of ETH" → stages order → you /confirm',
      '  "Show my portfolio" → current positions',
      "",
      "Copy Trading",
      `  Paste a ${brand}/post/... link → I'll copy that trade for you`,
      "",
      "Agent Features",
      '  "Remember that I never trade before 9am" → persistent memory',
      "  /skills → view and manage trading skills",
      "",
      "Commands: /status /help /credits /settings",
    ].join("\n");
  },

  /** Status command. */
  status(user: User, credits: { balance: number } | null, managedLeft: number, engine: string): string {
    const lines = [
      `Account: ${user.username || user.id.slice(0, 8)}`,
      `Engine: ${engine}`,
      `Starter messages: ${managedLeft} remaining`,
    ];
    if (credits) {
      lines.push(`LLM credits: $${credits.balance.toFixed(2)}`);
    }
    if (user.walletAddress) {
      lines.push(`Wallet: \`${user.walletAddress}\``);
    }
    return lines.join("\n");
  },

  /** Help command. */
  help(brand: string): string {
    return [
      `${brand} commands:`,
      "",
      "/start — restart onboarding",
      "/status — account overview",
      "/credits — check LLM credit balance",
      "/buy_credits <amount> — convert USDC → LLM credits",
      "/setkey <provider> <key> — bring your own API key",
      "/connect — manage Robinhood connections",
      "/trading — trading dashboard",
      "/skills — manage skills",
      "/settings — preferences",
      "/wipe — reset account",
      "/help — this message",
    ].join("\n");
  },

  /** Credits status. */
  credits(managedLeft: number, llmBalance: number | null): string {
    const lines = [`Starter messages: ${managedLeft} remaining`];
    if (llmBalance !== null) {
      lines.push(`Bankr LLM credits: $${llmBalance.toFixed(2)}`);
    }
    lines.push("", "Add more: /buy_credits <amount> USDC");
    lines.push("Or bring your own key: /setkey anthropic <key>");
    return lines.join("\n");
  },

  /** Blocked — no chat engine available. */
  blocked(): string {
    return [
      "Chat needs fuel.",
      "",
      "/buy_credits 5 — convert wallet USDC to LLM credits",
      "/setkey anthropic <key> — bring your own API key",
      "",
      "Starter messages are used up.",
    ].join("\n");
  },

  /** Invalid API key format. */
  invalidApiKey(provider: string, length: number): string {
    return `That doesn't look like a ${provider} API key (${length} chars with spaces or symbols). Nothing was saved.`;
  },
};
