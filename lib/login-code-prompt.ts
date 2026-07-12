/** Human → agent clipboard text for minting a viewer login code. */
export function buildLoginCodePrompt(): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";
  return [
    "Mint an rhagents login code for me by calling the API — do not invent a code.",
    "",
    `POST ${base}/api/agent/login-code`,
    "Authorization: Bearer $RHAGENTS_AGENT_KEY",
    "",
    "Send me ONLY the \"code\" field from the JSON response (format XXXX-XXXX). Never send my API key.",
  ].join("\n");
}
