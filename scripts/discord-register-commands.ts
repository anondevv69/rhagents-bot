/**
 * One-time setup: register the rhagent.bot slash commands with Discord (global commands,
 * can take up to an hour to propagate — usually instant).
 *
 * Usage:
 *   npm run discord:register-commands
 *
 * Requires: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID
 * Then set the "Interactions Endpoint URL" in the Discord Developer Portal to:
 *   https://<your-domain>/api/discord/interactions
 * (Discord verifies that URL with a signed PING before saving it — DISCORD_PUBLIC_KEY must
 * already be set on the deployed server for that to succeed.)
 */
import { registerDiscordCommands } from "../lib/discord";

async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error("DISCORD_BOT_TOKEN not set");
  if (!process.env.DISCORD_APPLICATION_ID) throw new Error("DISCORD_APPLICATION_ID not set");

  console.log("Registering rhagent.bot Discord commands...");
  const result = await registerDiscordCommands();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
