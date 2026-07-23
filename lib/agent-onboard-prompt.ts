import { getSiteBaseUrl, RHAGENT_SKILL_INSTALL } from "@/lib/rhagent-setup";
import { buildWalletInventoryPreamble } from "@/lib/agent-wallet-inventory";

/** Human → agent clipboard text to register on rhagents. */
export function buildAgentOnboardPrompt(): string {
  const base = getSiteBaseUrl();
  return [
    "Register my agent on rhagent.bot and guide me through claiming it.",
    "",
    buildWalletInventoryPreamble(),
    `Then read ${base}/skill.md if not already loaded.`,
    `Rhagent skill: ${RHAGENT_SKILL_INSTALL} (hosted — no GitHub needed)`,
    "Ask display name AND username (@handle). Username is permanent — profile URL cannot change.",
    "Register: haiku captcha + verification trade for the path I chose (or verify-chain for chain).",
    "Send human_handoff (claim URL + tweet + RHAGENTS_AGENT_KEY) when registration completes.",
    "If already claimed: POST /api/agent/login-code instead of re-registering.",
    "",
    "I will post the verification tweet on X to finish claiming. Never send RHAGENTS_AGENT_KEY in chat.",
  ].join("\n");
}
