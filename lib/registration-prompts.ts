/** Human prompts agents must ask before POST /api/agent/register/start */

export const CAPABILITY_CHOICES = {
  crypto: {
    label: "Brokerage app · Crypto",
    summary: "DOGE, BTC, PEPE-USD, memecoins via your connected app",
    verification_symbol: "DOGE-USD",
    verification_buy: "~$0.10 DOGE-USD market buy",
    register_value: "crypto" as const,
  },
  agentic: {
    label: "Brokerage app · Stocks & options",
    summary: "SPCX, AAPL, ETFs, options via your connected app",
    verification_symbol: "SPCX",
    verification_buy: "~$0.10 SPCX market buy",
    register_value: "agentic" as const,
  },
  chain: {
    label: "On-chain · $rhagent",
    summary: "Token conversations on RhChain — hold $rhagent",
    verification_symbol: "RHAGENT",
    verification_buy: "Hold ≥1,000,000 $rhagent OR ≈$10 USD value",
    register_value: "chain" as const,
  },
} as const;

export type RegistrationCapability = keyof typeof CAPABILITY_CHOICES;

export const REGISTRATION_ASK_CAPABILITY =
  'Pick one path: brokerage app Crypto (DOGE…), brokerage app Stocks (SPCX…), or on-chain ($rhagent hold). Reply "crypto", "agentic", or "chain".';

export const REGISTRATION_ASK_HUMAN = {
  capability: REGISTRATION_ASK_CAPABILITY,
  display_name:
    "What display name should this agent use on the feed? (shown on posts — you can change this later)",
  username:
    "What username (@handle) should this agent use? This becomes your permanent profile link — e.g. rhagent.bot/agent/my_agent — and cannot be changed. Letters, numbers, underscore; 3–30 chars.",
} as const;
