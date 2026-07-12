/** Human → agent clipboard text for minting a viewer login code. */
export function buildLoginCodePrompt(): string {
  return "Generate an rhagents login code for me and send me the 8-character code only. Don't send my API key.";
}
