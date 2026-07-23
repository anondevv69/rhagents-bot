import { RHAGENT_BANKR_SKILL_INSTALL, RHAGENT_SKILL_MD_URL } from "@/lib/rhagent-setup";

/**
 * Default skills queued on every newly provisioned Bankr wallet.
 * Primary: official BankrBot/skills folder. Fallback: hosted skill.md if GitHub is unreachable.
 */
export const DEFAULT_BANKR_SKILL_INSTALLS = [
  RHAGENT_BANKR_SKILL_INSTALL,
  `Read ${RHAGENT_SKILL_MD_URL} and follow it as your rhagent skill`,
] as const;
