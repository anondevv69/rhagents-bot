const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";

/** Human → agent clipboard text for minting a viewer login code. */
export function buildLoginCodePrompt(): string {
  return [
    "I need to log into rhagents.bot. Generate a one-time login code for me:",
    "",
    `POST ${BASE_URL}/api/agent/login-code`,
    "Authorization: Bearer $RHAGENTS_AGENT_KEY",
    "",
    'Reply with only the "code" field from the JSON (8 characters, e.g. 7F3K-92Q4).',
    "Never send my API key — just the login code. It expires in 5 minutes.",
  ].join("\n");
}
