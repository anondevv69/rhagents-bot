/** ─── User & Account ─── */

export type Platform = "telegram" | "discord" | "web";
export type UserTier = "free" | "starter" | "pro" | "partner";

export interface User {
  id: string;
  platformId: string;
  platform: Platform;
  username?: string;
  displayName?: string;
  tier: UserTier;
  createdAt: string;
  onboardingStep: OnboardingStep;
  walletAddress?: string;
  walletId?: string;
  /** Encrypted — never sent to client */
  bankrApiKey?: string;
}

/** ─── Onboarding State Machine ─── */

export type OnboardingStep =
  | "welcome"          // first /start — show intro
  | "connect_rh"       // prompt Robinhood connect
  | "wallet_ready"     // wallet provisioned, starter credits funded
  | "explore"          // show what they can do
  | "complete";        // fully set up

export interface OnboardingState {
  step: OnboardingStep;
  hasWallet: boolean;
  hasRobinhood: boolean;
  hasLlmCredits: boolean;
  hasApiKey: boolean;
  starterMessagesLeft: number;
}

/** ─── Bankr API ─── */

export type BankrFundChain = "robinhood" | "base" | "polygon" | "mainnet" | "unichain";

export interface BankrFundToken {
  tokenAddress: "native" | string;
  amount: string;
}

export interface BankrFundPayload {
  tokens: BankrFundToken[];
  chain: BankrFundChain;
}

export interface BankrProvisionResult {
  ok: true;
  evmAddress: string;
  walletId: string;
  apiKey: string;
  isNew: boolean;
}

export interface BankrProvisionError {
  ok: false;
  error: string;
}

export type BankrProvisionResponse = BankrProvisionResult | BankrProvisionError;

export interface BankrLlmCredits {
  balanceUsd: number;
  effectiveBalanceUsd: number;
}

export interface BankrWalletInfo {
  evmAddress: string;
  messagesRemaining?: number;
  clubActive?: boolean;
  maxModeEnabled?: boolean;
}

/** ─── Chat Engine ─── */

export type ChatEngine = "managed" | "bankr" | "byok" | "blocked";

/** ─── Trading ─── */

export type TradeVenue = "crypto" | "agentic";
export type TradeStatus = "staged" | "confirmed" | "executed" | "failed" | "cancelled" | "expired";

export interface Trade {
  id: string;
  userId: string;
  venue: TradeVenue;
  symbol: string;
  side: "buy" | "sell";
  quantity?: number;
  amountUsd?: number;
  status: TradeStatus;
  parentPostId?: string;
  createdAt: string;
  executedAt?: string;
}

/** ─── White-label ─── */

export interface BrandConfig {
  name: string;
  domain: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  /** Partner API key for Bankr provisioning */
  partnerKey?: string;
  /** Starter credit amount in USD */
  starterCreditUsd: number;
  /** Free managed inference messages */
  starterMessages: number;
}

export const DEFAULT_BRAND: BrandConfig = {
  name: "rhagent",
  domain: "rhagent.bot",
  primaryColor: "#000000",
  accentColor: "#22c55e",
  starterCreditUsd: 5,
  starterMessages: 25,
};
