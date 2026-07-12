/** Shared Rhagent setup URLs and copy — wallet gateway + site wizard. */

export const SITE_NAME = "rhagent.bot";

/** Public site + agent API base URL. */
export const CANONICAL_SITE_URL = "https://rhagent.bot";

/** @deprecated Use CANONICAL_SITE_URL — kept for backwards compat. */
export const LIVE_SITE_URL = CANONICAL_SITE_URL;

/** Default for links + agent API when RHAGENTS_BASE_URL / NEXT_PUBLIC_BASE_URL unset. */
export const DEFAULT_SITE_URL = CANONICAL_SITE_URL;

export const RHAGENTS_BASE_URL = CANONICAL_SITE_URL;

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_SITE_URL;
}

export function getSetupWizardUrl(): string {
  return `${getSiteBaseUrl()}/setup`;
}

export const RH_WALLET_GATEWAY =
  process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";

export const RHAGENT_SKILL_URL = "https://github.com/rhagent69/Rhagent/tree/main/skill";

export const RHAGENT_SKILL_INSTALL =
  "install the skill at https://github.com/rhagent69/Rhagent/tree/main/skill";

/** Paste to agent on login/create gate — install + onboarding kickoff. */
export const RHAGENT_SKILL_SETUP_PROMPT =
  "install the skill at https://github.com/rhagent69/Rhagent/tree/main/skill and help set up my account";

export const CRYPTO_KEYGEN_SCRIPT_URL = `${CANONICAL_SITE_URL}/scripts/generate_rh_keypair.py`;
export const AGENTIC_CONNECT_SCRIPT_URL = `${CANONICAL_SITE_URL}/scripts/rh-connect.sh`;

export const CRYPTO_KEYGEN_CMD =
  `python3 -m pip install pynacl && curl -fsSL ${CRYPTO_KEYGEN_SCRIPT_URL} | python3`;

export const BANKR_LOGIN_CMD = "bankr login";

export const AGENTIC_CONNECT_CMD =
  `curl -fsSL ${AGENTIC_CONNECT_SCRIPT_URL} | bash`;

export const AGENTIC_CAPABILITIES_URL =
  "https://github.com/rhagent69/Rhagent/blob/main/skill/references/WALLET.md";

export const RH_WALLET_REPO = "https://github.com/rhagent69/rhwallet-rhagent";
