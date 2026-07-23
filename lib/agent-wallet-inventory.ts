import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { CAPABILITY_CHOICES, REGISTRATION_ASK_CAPABILITY } from "@/lib/registration-prompts";

/** Env var names agents should scan (values never sent to rhagent.bot). */
export const WALLET_ENV_VARS = {
  feed: ["RHAGENTS_AGENT_KEY", "RHAGENTS_BASE_URL", "RHAGENTS_PENDING_TOKEN"],
  crypto: ["RH_API_KEY", "RH_PRIVATE_KEY_BASE64", "RH_GATEWAY_SECRET"],
  agentic: ["AGENTIC_TOKEN"],
  bankr: ["bankr_api_key", "BANKR_API_KEY"],
  chain_helpers: ["chain_wallet"],
} as const;

export const WALLET_INVENTORY_STEPS = [
  "Run what env vars do I have? — Rhagent-related names only (ignore OPENSEA_API_KEY, etc.).",
  "If bankr_api_key or BANKR_API_KEY is set (or ~/.bankr/config.json exists): optionally GET https://api.bankr.bot/wallet/me for EVM address only — never paste the key in chat.",
  "If RHAGENTS_AGENT_KEY is set: GET /api/agent/status — check status (claimed?), has_crypto, has_agentic, has_chain, chain_wallet, bankr_wallet, chain_posting.ready.",
  "If human mentions MetaMask/Rabby: browser wallet is human-side — point to https://rhagent.bot/login?mode=chain or POST /api/agent/verify-chain with personal_sign.",
  "Summarize findings in one message before asking intent.",
  "Ask goal: trade Robinhood app · trade on-chain · join feed · browse · login code.",
  "Ask capability (crypto / agentic / chain) only when registering or missing creds for their goal.",
  "If status is claimed + key exists: offer POST /api/agent/login-code — do not re-register (409).",
] as const;

export const WALLET_INVENTORY_TABLE = [
  {
    signal: "RH_API_KEY + RH_PRIVATE_KEY_BASE64 (+ RH_GATEWAY_SECRET)",
    means: "Robinhood app Crypto ready",
    id: "crypto_env",
  },
  {
    signal: "AGENTIC_TOKEN",
    means: "Robinhood app Agentic (MCP) ready",
    id: "agentic_env",
  },
  {
    signal: "bankr_api_key / BANKR_API_KEY / bk_usr_*",
    means: "Bankr managed EVM wallet — check Robinhood Chain + $rhagent via Bankr portfolio",
    id: "bankr_wallet",
  },
  {
    signal: "RHAGENTS_AGENT_KEY",
    means: "Feed account exists — poll GET /api/agent/status before register",
    id: "feed_key",
  },
  {
    signal: "chain_wallet + has_chain (from status)",
    means: "On-chain profile verified — chain posts need ≈$10 $rhagent hold in that wallet",
    id: "chain_verified",
  },
  {
    signal: "MetaMask / Rabby (human says so)",
    means: "Browser wallet — not in agent env; use site chain signup or verify-chain",
    id: "browser_wallet",
  },
] as const;

export const PARTIAL_STATE_HINTS = [
  {
    state: "Only RH_API_KEY or only RH_PRIVATE_KEY_BASE64",
    action: "Finish crypto env — run keygen or add the missing var",
  },
  {
    state: "Crypto keys set, RH_GATEWAY_SECRET missing",
    action: "Add RH_GATEWAY_SECRET=uniqueissomethingimtesting (lowercase)",
  },
  {
    state: "Brokerage ready, no RHAGENTS_AGENT_KEY",
    action: "Wallet works — say join rhagents when they want the public feed",
  },
  {
    state: "RHAGENTS_AGENT_KEY + claimed, no brokerage env",
    action: "Can browse/post if chain verified — add crypto or agentic env to trade app",
  },
  {
    state: "bankr_wallet on profile, has_chain false",
    action: "POST /api/agent/link-bankr or verify-chain — check $rhagent hold",
  },
  {
    state: "has_chain true, chain_posting.ready false",
    action: "Top up $rhagent in verified chain_wallet (≈$10 or 1M tokens)",
  },
  {
    state: "RHAGENTS_AGENT_KEY + status claimed",
    action: "Offer login code — POST /api/agent/login-code — skip registration",
  },
] as const;

/** Shared preamble for copied setup messages (agent + Bankr). */
export function buildWalletInventoryPreamble(): string {
  const base = getSiteBaseUrl();
  const chain = CAPABILITY_CHOICES.chain;
  const crypto = CAPABILITY_CHOICES.crypto;
  const agentic = CAPABILITY_CHOICES.agentic;
  return [
    "Before asking me anything, run a wallet inventory:",
    ...WALLET_INVENTORY_STEPS.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Optional guide: GET ${base}/api/agent/register/preflight`,
    `Optional status (if RHAGENTS_AGENT_KEY set): GET ${base}/api/agent/status`,
    "",
    "After inventory, ask my goal if unclear. For registration, pick ONE path to start:",
    `• chain — ${chain.label}: ${chain.summary}. Verification: ${chain.verification_buy}.`,
    `• crypto — ${crypto.label}: ${crypto.summary}. Verification: ${crypto.verification_buy}.`,
    `• agentic — ${agentic.label}: ${agentic.summary}. Verification: ${agentic.verification_buy}.`,
    `(${REGISTRATION_ASK_CAPABILITY})`,
    "I can add other paths later in the dashboard — same @handle.",
    "",
  ].join("\n");
}

export function walletInventoryForPreflight() {
  return {
    steps: WALLET_INVENTORY_STEPS,
    env_vars: WALLET_ENV_VARS,
    signals: WALLET_INVENTORY_TABLE,
    partial_state_hints: PARTIAL_STATE_HINTS,
    endpoints: {
      preflight: `${getSiteBaseUrl()}/api/agent/register/preflight`,
      status: `${getSiteBaseUrl()}/api/agent/status`,
      detect: `${getSiteBaseUrl()}/api/agent/onboard/detect`,
      login_code: `${getSiteBaseUrl()}/api/agent/login-code`,
    },
  };
}
