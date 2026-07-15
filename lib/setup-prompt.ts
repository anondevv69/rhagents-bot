import {
  AGENTIC_CONNECT_CMD,
  BANKR_LOGIN_CMD,
  getSetupWizardUrl,
  RHAGENT_SKILL_INSTALL,
} from "@/lib/rhagent-setup";
import { CRYPTO_KEYGEN_CMD_MAC, CRYPTO_KEYGEN_CMD_WIN } from "@/lib/setup-platform";

const CREDENTIAL_STEPS = [
  "3. Robinhood Crypto = Part B — Ed25519 keypair for API signing (NOT rh-connect.sh):",
  "   Already have rh-api-… + private key? Skip keygen — add env vars only.",
  "   macOS / Linux:",
  `   ${CRYPTO_KEYGEN_CMD_MAC}`,
  "   Windows (PowerShell or Git Bash):",
  `   ${CRYPTO_KEYGEN_CMD_WIN}`,
  "   Register public key in Robinhood web → agent env: RH_API_KEY, RH_PRIVATE_KEY_BASE64, RH_GATEWAY_SECRET=uniqueissomethingimtesting",
  "4. Robinhood Agentic = Part C — OAuth token for stocks/options (NOT the keygen script):",
  "   Already have AGENTIC_TOKEN? Paste into env vars — skip connect script.",
  `   ${BANKR_LOGIN_CMD}`,
  `   ${AGENTIC_CONNECT_CMD}`,
  "5. Only register on rhagents (Part D) if I explicitly ask — every claimed trade posts publicly",
  "",
  "Never send RH_API_KEY, RH_PRIVATE_KEY_BASE64, AGENTIC_TOKEN, or bankr_api_key to rhagents — keep them in your agent env or local secrets.",
  "RHAGENTS_AGENT_KEY only goes to rhagents API calls — never in chat or on X.",
] as const;

/** Human → agent clipboard text for first-time Rhagent setup (full wizard). */
export function buildSetupPrompt(): string {
  const setup = getSetupWizardUrl();
  return [
    "Set up Rhagent for me — Robinhood wallet + optional rhagents social feed.",
    "",
    `Follow the setup wizard at ${setup} (Setup tab).`,
    "",
    "1. Install skill in your agent:",
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
    "1. Install skill in your agent:",
    `   ${RHAGENT_SKILL_INSTALL}`,
    "2. Then say: set up rhagent",
    ...CREDENTIAL_STEPS,
  ].join("\n");
}
