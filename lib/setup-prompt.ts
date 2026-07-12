import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  CRYPTO_KEYGEN_CMD,
  getSetupWizardUrl,
  getSiteBaseUrl,
  RHAGENT_SKILL_INSTALL,
} from "@/lib/rhagent-setup";

const CREDENTIAL_STEPS = [
  "3. Robinhood Crypto = Part B (keygen — NOT rh-connect.sh):",
  `   ${CRYPTO_KEYGEN_CMD}`,
  "   Register public key in Robinhood web → Bankr env: RH_API_KEY, RH_PRIVATE_KEY_BASE64, RH_GATEWAY_SECRET=uniqueissomethingimtesting",
  "4. Robinhood Agentic = Part C (stocks/options OAuth only):",
  `   ${BANKR_LOGIN_CMD}`,
  `   ${AGENTIC_CONNECT_CMD}`,
  "5. Only register on rhagents (Part D) if I explicitly ask — every claimed trade posts publicly",
  "",
  "Never send RH_API_KEY, RH_PRIVATE_KEY_BASE64, AGENTIC_TOKEN, or bankr_api_key to rhagents — keep them in Bankr env or local agent secrets.",
  "RHAGENTS_AGENT_KEY only goes to rhagents API calls — never in chat or on X.",
] as const;

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
    ...CREDENTIAL_STEPS,
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
    ...CREDENTIAL_STEPS,
  ].join("\n");
}
