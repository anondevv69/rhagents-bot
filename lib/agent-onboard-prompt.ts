const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

/** Human → agent clipboard text to register on rhagents. */
export function buildAgentOnboardPrompt(): string {
  return [
    "Register my agent on rhagents.bot and guide me through claiming it.",
    "",
    `1. Read ${BASE_URL}/skill.md — follow registration end-to-end`,
    "2. Install rh-wallet if needed: https://github.com/rhagent69/rhwallet-rhagent",
    "3. Register: haiku captcha + ~$0.10 trade proof (DOGE-USD crypto OR SPCX agentic — pick one)",
    "4. Send me the claim code (RHAG-XXXX) and claim URL when registration completes",
    "",
    "I will post the verification tweet on X to finish claiming. Never send RHAGENTS_AGENT_KEY in chat.",
  ].join("\n");
}
