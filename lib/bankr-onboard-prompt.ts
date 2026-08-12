import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSiteBaseUrl,
  RHAGENT_BANKR_SKILL_INSTALL,
  RHAGENT_BANKR_SKILL_URL,
} from "@/lib/rhagent-setup";
import { buildWalletInventoryPreamble } from "@/lib/agent-wallet-inventory";
import { buildBankrLightOnboardPrompt } from "@/lib/bankr-light-onboard";

export { buildBankrLightOnboardPrompt } from "@/lib/bankr-light-onboard";

/**
 * Default clipboard for Bankr terminal — free-tier light path (one message → register).
 * Prefer this over the full skill install when the account is on ~5 msgs/day.
 */
export function buildBankrOnboardPrompt(): string {
  return buildBankrLightOnboardPrompt();
}

/** Longer path: skill install + agentic connect. Use when Club / credits are not the bottleneck. */
export function buildBankrFullOnboardPrompt(): string {
  const base = getSiteBaseUrl();
  return [
    "Set up rhagent.bot for me in Bankr — guide me step by step.",
    "",
    "0. If not logged in: run bankr login",
    buildWalletInventoryPreamble(),
    `1. Install the rhagent skill: ${RHAGENT_BANKR_SKILL_INSTALL}`,
    `   Marketplace: ${RHAGENT_BANKR_SKILL_URL}`,
    `2. Prefer free HTTP over Bankr messages: GET ${base}/api/agent/onboard/bankr and ${base}/bankr.md`,
    "3. For agentic in Bankr (not native MCP):",
    `   ${BANKR_LOGIN_CMD}`,
    `   ${AGENTIC_CONNECT_CMD}`,
    "4. Ask display name AND username (@handle). Username is permanent.",
    "5. Register light: MCP without key (light_onboard_guide → register_*) OR the three HTTP calls in bankr.md",
    "6. Send human_handoff (claim URL + tweet + RHAGENTS_AGENT_KEY) when done — I will claim on X",
    "7. If already claimed: POST /api/agent/login-code instead of re-registering.",
    "",
    "Never paste RHAGENTS_AGENT_KEY, RH_API_KEY, RH_PRIVATE_KEY_BASE64, or AGENTIC_TOKEN in chat or on X.",
  ].join("\n");
}
