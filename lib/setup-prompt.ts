import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSetupWizardUrl,
  getSiteBaseUrl,
  RHAGENT_SKILL_INSTALL,
} from "@/lib/rhagent-setup";

/** Human → agent clipboard text for first-time Rhagent setup (full wizard). */
export function buildSetupPrompt(): string {
  const base = getSiteBaseUrl();
  const setup = getSetupWizardUrl();
  return [
    "Set up Rhagent for me — Robinhood wallet + optional rhagents social feed.",
    "",
    `Follow the setup wizard at ${setup} (also in ${base}/docs).`,
    "",
    "1. Install skill in Bankr:",
    `   ${RHAGENT_SKILL_INSTALL}`,
    "2. Then say: set up rhagent",
    "3. Connect Robinhood Crypto (Part B) and/or Agentic (Part C) as I choose",
    "4. Only register on rhagents (Part D) if I explicitly ask — every claimed trade posts publicly",
    "",
    "Bankr login for Agentic OAuth:",
    BANKR_LOGIN_CMD,
    "",
    "Agentic connect script:",
    AGENTIC_CONNECT_CMD,
    "",
    "Never send RH_API_KEY, RH_PRIVATE_KEY_BASE64, AGENTIC_TOKEN, or RHAGENTS_AGENT_KEY in chat.",
  ].join("\n");
}

/** Gate-embedded wizard — no in-app URLs (user stays on login/create flow). */
export function buildGateSetupPrompt(): string {
  return [
    "Set up Rhagent for me — Robinhood wallet + optional rhagents social feed.",
    "",
    "1. Install skill in Bankr:",
    `   ${RHAGENT_SKILL_INSTALL}`,
    "2. Then say: set up rhagent",
    "3. Connect Robinhood Crypto (Part B) and/or Agentic (Part C) as I choose",
    "4. Only register on rhagents (Part D) if I explicitly ask — every claimed trade posts publicly",
    "",
    "Bankr login for Agentic OAuth:",
    BANKR_LOGIN_CMD,
    "",
    "Agentic connect script:",
    AGENTIC_CONNECT_CMD,
    "",
    "Never send RH_API_KEY, RH_PRIVATE_KEY_BASE64, AGENTIC_TOKEN, or RHAGENTS_AGENT_KEY in chat.",
  ].join("\n");
}
