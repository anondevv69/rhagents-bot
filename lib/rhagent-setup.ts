/** Shared Rhagent setup URLs and copy — wallet gateway + site wizard. */

export const SITE_NAME = "rhagent.bot";

/** Public site + agent API base URL. */
export const CANONICAL_SITE_URL = "https://rhagent.bot";

/** @deprecated Use CANONICAL_SITE_URL — kept for backwards compat. */
export const LIVE_SITE_URL = CANONICAL_SITE_URL;

/** Default for links + agent API when RHAGENTS_BASE_URL / NEXT_PUBLIC_BASE_URL unset. */
export const DEFAULT_SITE_URL = CANONICAL_SITE_URL;

export const RHAGENTS_BASE_URL = CANONICAL_SITE_URL;

/** Public docs subdomain — setup, API reference, skill.md mirror. */
export const DOCS_HOST = process.env.DOCS_HOST ?? "docs.rhagent.bot";

export function getSiteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? DEFAULT_SITE_URL;
}

/** Human-facing docs portal (docs.rhagent.bot when NEXT_PUBLIC_DOCS_URL is set). */
export function getDocsBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DOCS_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return getSiteBaseUrl();
}

export function getDocsPageUrl(hash?: string): string {
  const base = getDocsBaseUrl();
  const onSubdomain = Boolean(process.env.NEXT_PUBLIC_DOCS_URL?.trim());
  const path = onSubdomain ? "" : "/docs";
  const url = `${base}${path}`;
  return hash ? `${url}#${hash.replace(/^#/, "")}` : url;
}

export function getSetupWizardUrl(): string {
  return getDocsPageUrl("app");
}

export const RH_WALLET_GATEWAY =
  process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";

/** Hosted skill doc — works when GitHub is down; agents curl or Read this URL. */
export const RHAGENT_SKILL_MD_URL = `${CANONICAL_SITE_URL}/skill.md`;

/** Canonical Bankr skills marketplace folder (official install path). */
export const RHAGENT_BANKR_SKILL_URL = "https://github.com/BankrBot/skills/tree/main/rhagent";

/** GitHub skill folder — optional; plugin/skills.sh installs need repo access. */
export const RHAGENT_SKILL_URL = "https://github.com/rhagent69/Rhagent/tree/main/skill";

/** Claude Code / skills.sh marketplace — same skill, one-command install (requires GitHub). */
export const RHAGENT_CLAUDE_PLUGINS_REPO = "https://github.com/rhagent69/Rhagent";
export const RHAGENT_CLAUDE_PLUGIN_INSTALL =
  "claude plugin marketplace add rhagent69/Rhagent && claude plugin install rhagent@rhagent-claude-plugins";
export const RHAGENT_SKILLS_SH_INSTALL =
  "bunx skills add rhagent69/Rhagent --skill rhagent -y";

/** Primary install line — hosted .md (no GitHub required). */
export const RHAGENT_SKILL_INSTALL = `Read ${RHAGENT_SKILL_MD_URL} and follow the instructions to join rhagent`;

/** Bankr wallet provision — official skills folder (BankrBot marketplace). */
export const RHAGENT_BANKR_SKILL_INSTALL = `install the skill at ${RHAGENT_BANKR_SKILL_URL}`;

/** Paste to agent on login/create gate — install + onboarding kickoff. */
export const RHAGENT_SKILL_SETUP_PROMPT = RHAGENT_SKILL_INSTALL;

/** Legacy GitHub install — use when repo is reachable and you want a local skill folder. */
export const RHAGENT_SKILL_GITHUB_INSTALL =
  "install the skill at https://github.com/rhagent69/Rhagent/tree/main/skill";

export const CRYPTO_KEYGEN_SCRIPT_URL = `${CANONICAL_SITE_URL}/scripts/generate_rh_keypair.py`;
export const AGENTIC_CONNECT_SCRIPT_URL = `${CANONICAL_SITE_URL}/scripts/rh-connect.sh`;

export const CRYPTO_KEYGEN_CMD =
  `python3 -m pip install pynacl && curl -fsSL ${CRYPTO_KEYGEN_SCRIPT_URL} | python3`;

export const BANKR_LOGIN_CMD = "bankr login";

export const AGENTIC_CONNECT_CMD =
  `curl -fsSL ${AGENTIC_CONNECT_SCRIPT_URL} | bash`;

/** Telegram bot path — stages token + Open Telegram deep link. */
export const AGENTIC_CONNECT_TELEGRAM_CMD =
  `curl -fsSL ${AGENTIC_CONNECT_SCRIPT_URL} | RH_CONNECT_FOR=telegram bash`;

/** Public Agentic setup wizard (proxied from RH Wallet gateway). */
export function getAgenticSetupUrl(forClient?: "telegram"): string {
  const q = forClient === "telegram" ? "?for=telegram" : "";
  return `${getSiteBaseUrl()}/agentic/setup${q}`;
}

export const AGENTIC_CAPABILITIES_URL =
  "https://github.com/rhagent69/Rhagent/blob/main/skill/references/AGENTIC-CAPABILITIES.md";

/** Public skill + connect-script repo — the code that actually touches a user's keys locally.
 *  (The Railway gateway source is closed; this is what "we never see your keys" claims point at.) */
export const RH_WALLET_REPO = "https://github.com/rhagent69/Rhagent";

/** Per-client table: Robinhood's native MCP + our skill, side by side. */
export const CLIENTS_DOC_URL = `${CANONICAL_SITE_URL}/skill.md#7-per-client-setup`;
