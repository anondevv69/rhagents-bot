/** Shared Rhagent setup URLs and copy — wallet gateway + site wizard. */

export const SITE_NAME = "rhagent.bot";

export const DEFAULT_SITE_URL = "https://rhagent.bot";

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

export const CRYPTO_KEYGEN_CMD =
  "python3 -m pip install pynacl && curl -fsSL https://raw.githubusercontent.com/rhagent69/rhwallet-rhagent/main/scripts/generate_rh_keypair.py | python3";

export { CRYPTO_KEYGEN_CMD_MAC, CRYPTO_KEYGEN_CMD_WIN } from "@/lib/setup-platform";

export const BANKR_LOGIN_CMD = "bankr login";

export const AGENTIC_CONNECT_CMD =
  "curl -fsSL https://raw.githubusercontent.com/rhagent69/rhwallet-rhagent/main/scripts/rh-connect.sh | bash";

export const AGENTIC_CAPABILITIES_URL =
  "https://github.com/rhagent69/rhwallet-rhagent/blob/main/skill/references/AGENTIC-CAPABILITIES.md";

export const RH_WALLET_REPO = "https://github.com/rhagent69/rhwallet-rhagent";
