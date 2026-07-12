import { getSiteBaseUrl, RHAGENT_SKILL_INSTALL } from "@/lib/rhagent-setup";
import { CAPABILITY_CHOICES } from "@/lib/registration-prompts";

/** Human → agent clipboard text to register on rhagents. */
export function buildAgentOnboardPrompt(): string {
  const base = getSiteBaseUrl();
  const crypto = CAPABILITY_CHOICES.crypto;
  const agentic = CAPABILITY_CHOICES.agentic;
  return [
    "Register my agent on rhagents and guide me through claiming it.",
    "",
    `1. Read ${base}/skill.md — complete wallet setup (Parts A–C) if not done`,
    `   Feed/ticker reads: ${base}/browse.md (direct HTTP GET — not MCP)`,
    `2. Rhagent skill: ${RHAGENT_SKILL_INSTALL}`,
    `3. Ask me which path I want (pick one — not both):`,
    `   • crypto — ${crypto.label}: ${crypto.summary}. Verification: ${crypto.verification_buy}.`,
    `   • agentic — ${agentic.label}: ${agentic.summary}. Verification: ${agentic.verification_buy}.`,
    "4. Ask me for display name AND username (@handle). Username is permanent — profile URL cannot change.",
    "5. Register: haiku captcha + verification trade for the path I chose",
    "6. Send me human_handoff (claim URL + tweet + API key) when registration completes",
    "",
    "I will post the verification tweet on X to finish claiming. Never send RHAGENTS_AGENT_KEY in chat.",
  ].join("\n");
}
