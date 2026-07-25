/**
 * Onboarding state machine — clean, linear, non-overwhelming.
 *
 * Design philosophy:
 * 1. One message per step. Never dump a wall of text.
 * 2. Auto-provision wallet silently. Don't ask if they want one.
 * 3. Show value immediately — they can chat with 25 free messages before anything else.
 * 4. Progressive disclosure: connect Robinhood only when they want to trade.
 *
 * Steps:
 *   welcome      → wallet auto-provisioned, show intro + what they can do
 *   connect_rh   → prompted when they try a trade or explicitly ask
 *   wallet_ready → wallet + credits confirmed working
 *   explore      → shown once after first successful interaction
 *   complete     → onboarding done, normal operation
 */

import type { OnboardingStep, OnboardingState, User, Platform } from "@rhagent/shared";
import { BankrClient } from "@rhagent/shared";
import { findOrCreateUser, updateOnboardingStep, updateWallet } from "../db/users.js";
import { setSecret, hasSecret, getSecret } from "../db/vault.js";
import { env } from "../env.js";
import { messages } from "./messages.js";

const bankr = new BankrClient({
  partnerKey: env.bankrPartnerKey,
  starterCreditUsd: env.bankrStarterCreditUsd,
  fundEth: env.bankrFundEth || undefined,
});

export interface OnboardingResult {
  text: string;
  buttons?: Button[];
  /** Move to this step after sending */
  nextStep?: OnboardingStep;
}

export interface Button {
  label: string;
  action: string;
}

/**
 * Handle /start — the single entry point for every new and returning user.
 */
export async function handleStart(
  platform: Platform,
  platformId: string,
  opts: { username?: string; displayName?: string } = {},
): Promise<OnboardingResult> {
  const user = findOrCreateUser(platform, platformId, opts);

  // Returning user — skip onboarding
  if (user.onboardingStep === "complete") {
    return {
      text: messages.welcomeBack(user, env.brandName),
      buttons: [
        { label: "Chat", action: "chat" },
        { label: "Trade", action: "trade" },
        { label: "Status", action: "cmd:status" },
      ],
    };
  }

  // New or incomplete — run through onboarding
  return runOnboardingStep(user);
}

/**
 * Core state machine — determines what to show based on current step.
 */
async function runOnboardingStep(user: User): Promise<OnboardingResult> {
  switch (user.onboardingStep) {
    case "welcome":
      return handleWelcome(user);
    case "connect_rh":
      return handleConnectRh(user);
    case "wallet_ready":
      return handleWalletReady(user);
    case "explore":
      return handleExplore(user);
    case "complete":
      return { text: messages.welcomeBack(user, env.brandName) };
  }
}

/**
 * Step 1: Welcome — auto-provision wallet, show intro.
 * User doesn't need to decide anything. Wallet happens in background.
 */
async function handleWelcome(user: User): Promise<OnboardingResult> {
  // Auto-provision wallet silently
  let walletError: string | null = null;
  if (!user.walletAddress) {
    const result = await bankr.provisionWallet(user.platform, user.id, user.platformId);
    if (result.ok) {
      updateWallet(user.id, result.evmAddress, result.walletId);
      setSecret(user.id, "bankr_api_key", result.apiKey);
      user.walletAddress = result.evmAddress;
      user.walletId = result.walletId;

      // Fire-and-forget: convert starter USDC → LLM credits
      if (result.isNew && env.bankrStarterCreditUsd > 0) {
        void bankr.convertStarterCredits(result.apiKey, env.bankrStarterCreditUsd).catch(() => undefined);
      }
    } else {
      walletError = result.error;
    }
  }

  updateOnboardingStep(user.id, "wallet_ready");

  return {
    text: messages.welcome(user, env.brandName, env.dashboardUrl, walletError),
    buttons: [
      { label: "Connect Robinhood", action: "onboard:connect_rh" },
      { label: "Just chat", action: "onboard:skip_rh" },
      { label: "Dashboard", action: `url:${env.dashboardUrl}/dashboard` },
    ],
    nextStep: "wallet_ready",
  };
}

/**
 * Step 2: Connect Robinhood — only shown when user wants to trade.
 */
async function handleConnectRh(user: User): Promise<OnboardingResult> {
  return {
    text: messages.connectRobinhood(env.dashboardUrl),
    buttons: [
      { label: "Connect Crypto", action: `url:${env.dashboardUrl}/dashboard?tab=connections&connect=crypto` },
      { label: "Connect Agentic", action: `url:${env.dashboardUrl}/dashboard?tab=connections&connect=agentic` },
      { label: "Skip for now", action: "onboard:skip_rh" },
    ],
  };
}

/**
 * Step 3: Wallet ready — confirm everything is working.
 */
async function handleWalletReady(user: User): Promise<OnboardingResult> {
  updateOnboardingStep(user.id, "explore");

  return {
    text: messages.walletReady(user, env.managedInferenceMessages),
    buttons: [
      { label: "Try asking something", action: "onboard:explore" },
      { label: "Connect Robinhood", action: "onboard:connect_rh" },
    ],
    nextStep: "explore",
  };
}

/**
 * Step 4: Explore — show capabilities, mark complete.
 */
async function handleExplore(user: User): Promise<OnboardingResult> {
  updateOnboardingStep(user.id, "complete");

  return {
    text: messages.explore(env.brandName),
    nextStep: "complete",
  };
}

/**
 * Get current onboarding state for dashboard display.
 */
export function getOnboardingState(user: User): OnboardingState {
  return {
    step: user.onboardingStep,
    hasWallet: !!user.walletAddress,
    hasRobinhood: false, // TODO: check connections table
    hasLlmCredits: hasSecret(user.id, "bankr_api_key"),
    hasApiKey: hasSecret(user.id, "bankr_api_key"),
    starterMessagesLeft: Math.max(0, env.managedInferenceMessages - getManagedUsed(user.id)),
  };
}

function getManagedUsed(userId: string): number {
  const { getDb } = require("../db/schema.js");
  const row = getDb()
    .prepare("SELECT managed_messages_used FROM users WHERE id = ?")
    .get(userId) as { managed_messages_used: number } | undefined;
  return row?.managed_messages_used ?? 0;
}
