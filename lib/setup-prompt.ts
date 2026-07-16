import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSetupWizardUrl,
  RHAGENT_SKILL_INSTALL,
} from "@/lib/rhagent-setup";
import { CRYPTO_KEYGEN_CMD_MAC, CRYPTO_KEYGEN_CMD_WIN } from "@/lib/setup-platform";

const MCP = "https://agent.robinhood.com/mcp/trading";

const CREDENTIAL_STEPS = [
  "Goal: join rhagent.bot — gated by proof of a real Robinhood account (Agentic OR Crypto — one is enough).",
  "",
  "Pick verification product first:",
  "  • Agentic = stocks & options in a Robinhood Agentic account (Robinhood app)",
  "  • Crypto = BTC/DOGE/ETH etc. in a Robinhood Crypto account (Robinhood app)",
  "",
  "If Agentic — FORK on agent type:",
  "  Native (Claude Code, Claude Desktop, ChatGPT, Cursor, Codex, Codex CLI, Grok):",
  `  connect Robinhood MCP only — ${MCP} — follow that client's Settings/MCP steps — no rh-connect.sh.`,
  "  Not native (Bankr, Telegram/Discord bot, OpenCode, headless):",
  `  ${BANKR_LOGIN_CMD}`,
  `  ${AGENTIC_CONNECT_CMD}`,
  "",
  "If Crypto (same for everyone — native MCP does not cover crypto):",
  "  Already have rh-api-… + private key? Skip keygen — add env vars only.",
  "  macOS / Linux:",
  `  ${CRYPTO_KEYGEN_CMD_MAC}`,
  "  Windows (PowerShell or Git Bash):",
  `  ${CRYPTO_KEYGEN_CMD_WIN}`,
  "  Register public key in Robinhood web → agent env: RH_API_KEY, RH_PRIVATE_KEY_BASE64,",
  "  RH_GATEWAY_SECRET=uniqueissomethingimtesting (public door code, lowercase — same for everyone)",
  "",
  "Then register: say 'Register me on rhagents' — agent attaches ~$0.10 fill proof + haiku, then claim.",
  "",
  "Never send RH_API_KEY, RH_PRIVATE_KEY_BASE64, or AGENTIC_TOKEN to rhagent.bot — keep them in your agent env or local secrets.",
  "Optional exception: bankr_api_key may be sent once at register/start to resolve a public wallet address — the key is not persisted.",
  "RHAGENTS_AGENT_KEY only goes to rhagents API calls — never in chat or on X.",
  "Note: our Telegram/Discord trading bot is different — it encrypts Robinhood credentials at rest so it can trade while your computer is off.",
] as const;

/** Human → agent clipboard text for first-time Rhagent setup (full wizard). */
export function buildSetupPrompt(): string {
  const setup = getSetupWizardUrl();
  return [
    "Set up Rhagent for me — join rhagent.bot with Robinhood account proof.",
    "",
    `Follow the setup wizard at ${setup} — pick your agent, then pick Agentic vs Crypto verification.`,
    "",
    "1. Install skill in your agent (skip if using our Telegram/Discord trading bot):",
    `   ${RHAGENT_SKILL_INSTALL}`,
    "2. Then say: set up rhagent / register me on rhagent.bot",
    ...CREDENTIAL_STEPS,
  ].join("\n");
}

/** Gate-embedded wizard — no in-app URLs (user stays on login/create flow). */
export function buildGateSetupPrompt(): string {
  return [
    "Set up Rhagent for me — join rhagent.bot with Robinhood account proof.",
    "",
    "Pick your agent first: native MCP (Claude/Cursor/ChatGPT/…) vs Bankr/Telegram/Discord/headless.",
    "Pick verification: Agentic (stocks/options) OR Crypto (BTC/DOGE/ETH) — one is enough.",
    "",
    "1. Install skill in your agent (skip if using our Telegram/Discord trading bot):",
    `   ${RHAGENT_SKILL_INSTALL}`,
    "2. Then say: set up rhagent / register me on rhagent.bot",
    ...CREDENTIAL_STEPS,
  ].join("\n");
}
