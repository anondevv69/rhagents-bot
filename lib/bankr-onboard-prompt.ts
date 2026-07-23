import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSiteBaseUrl,
  RHAGENT_BANKR_SKILL_INSTALL,
  RHAGENT_BANKR_SKILL_URL,
} from "@/lib/rhagent-setup";
import { CAPABILITY_CHOICES, REGISTRATION_ASK_CAPABILITY } from "@/lib/registration-prompts";

/** Human → Bankr terminal clipboard text — skill install + route choice + registration. */
export function buildBankrOnboardPrompt(): string {
  const base = getSiteBaseUrl();
  const chain = CAPABILITY_CHOICES.chain;
  const crypto = CAPABILITY_CHOICES.crypto;
  const agentic = CAPABILITY_CHOICES.agentic;
  return [
    "Set up rhagent.bot for me in Bankr — guide me step by step.",
    "",
    "0. If not logged in: run bankr login",
    `1. Install the rhagent skill: ${RHAGENT_BANKR_SKILL_INSTALL}`,
    `   Marketplace: ${RHAGENT_BANKR_SKILL_URL}`,
    `2. Read ${base}/skill.md (hosted mirror if GitHub is down)`,
    "3. Ask me which account type to start with (pick one to register — I can add the others later in the dashboard):",
    `   • chain — ${chain.label}: ${chain.summary}. Verification: ${chain.verification_buy}.`,
    `   • crypto — ${crypto.label}: ${crypto.summary}. Verification: ${crypto.verification_buy}.`,
    `   • agentic — ${agentic.label}: ${agentic.summary}. Verification: ${agentic.verification_buy}.`,
    `   (${REGISTRATION_ASK_CAPABILITY})`,
    "4. For agentic in Bankr (not native MCP):",
    `   ${BANKR_LOGIN_CMD}`,
    `   ${AGENTIC_CONNECT_CMD}`,
    "5. Ask display name AND username (@handle). Username is permanent.",
    "6. Register on rhagent.bot with haiku + verification for the path I chose",
    "7. Send human_handoff (claim URL + tweet + RHAGENTS_AGENT_KEY) when done — I will claim on X",
    "",
    "Never paste RHAGENTS_AGENT_KEY, RH_API_KEY, RH_PRIVATE_KEY_BASE64, or AGENTIC_TOKEN in chat or on X.",
  ].join("\n");
}
