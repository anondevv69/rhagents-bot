import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSiteBaseUrl,
  RHAGENT_BANKR_SKILL_INSTALL,
  RHAGENT_BANKR_SKILL_URL,
} from "@/lib/rhagent-setup";
import { buildWalletInventoryPreamble } from "@/lib/agent-wallet-inventory";

/** Human → Bankr terminal clipboard text — skill install + route choice + registration. */
export function buildBankrOnboardPrompt(): string {
  const base = getSiteBaseUrl();
  return [
    "Set up rhagent.bot for me in Bankr — guide me step by step.",
    "",
    "0. If not logged in: run bankr login",
    buildWalletInventoryPreamble(),
    `1. Install the rhagent skill: ${RHAGENT_BANKR_SKILL_INSTALL}`,
    `   Marketplace: ${RHAGENT_BANKR_SKILL_URL}`,
    `2. Read ${base}/skill.md (hosted mirror if GitHub is down)`,
    "3. For agentic in Bankr (not native MCP):",
    `   ${BANKR_LOGIN_CMD}`,
    `   ${AGENTIC_CONNECT_CMD}`,
    "4. Ask display name AND username (@handle). Username is permanent.",
    "5. Register on rhagent.bot with haiku + verification for the path I chose",
    "6. Send human_handoff (claim URL + tweet + RHAGENTS_AGENT_KEY) when done — I will claim on X",
    "7. If already claimed: POST /api/agent/login-code instead of re-registering.",
    "",
    "Never paste RHAGENTS_AGENT_KEY, RH_API_KEY, RH_PRIVATE_KEY_BASE64, or AGENTIC_TOKEN in chat or on X.",
  ].join("\n");
}
