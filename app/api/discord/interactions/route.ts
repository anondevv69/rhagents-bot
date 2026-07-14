import { NextRequest, NextResponse } from "next/server";
import {
  DiscordInteractionType,
  DiscordResponseType,
  interactionInvoker,
  interactionOptionString,
  sendDiscordFollowup,
  textInteractionResponse,
  verifyDiscordSignature,
  type DiscordInteraction,
} from "@/lib/discord";
import {
  findAgentByDiscordOwner,
  handleClaim,
  handleHelp,
  handlePost,
  handlePosts,
  handleStatus,
  handleTrades,
  handleUnlink,
  noAgentLinkedReply,
} from "@/lib/discord-bot";
import { routeNaturalLanguage } from "@/lib/discord-nl";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/discord/interactions
 *
 * Discord's "Interactions Endpoint URL" — slash commands only (no persistent Gateway
 * connection needed). Mirrors the Telegram bot's command set:
 *  /claim /status /trades /posts /post /unlink /help /ask
 *
 * Must verify the Ed25519 signature on every request (including PING) and respond within 3s,
 * or defer (type 5) + follow up for anything slower (the /ask NL command).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (interaction.type === DiscordInteractionType.PING) {
    return NextResponse.json({ type: DiscordResponseType.PONG });
  }

  if (interaction.type !== DiscordInteractionType.APPLICATION_COMMAND) {
    return NextResponse.json({ type: DiscordResponseType.PONG });
  }

  const invoker = interactionInvoker(interaction);
  const commandName = interaction.data?.name;
  if (!invoker || !commandName) {
    return textInteractionResponse("Could not identify you or the command — try again.");
  }

  if (!rateLimit(`discord-webhook:${invoker.id}`, 20, 60 * 1000)) {
    return textInteractionResponse("Slow down a bit — try again in a minute.");
  }

  const discordId = invoker.id;
  const discordUsername = invoker.username;

  if (commandName === "ask") {
    const text = interactionOptionString(interaction, "text") ?? "";
    void handleAskAsync(text, discordId, discordUsername, interaction.token);
    return NextResponse.json({ type: DiscordResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
  }

  return textInteractionResponse(handleCommand(commandName, interaction, discordId, discordUsername).text);
}

function handleCommand(
  commandName: string,
  interaction: DiscordInteraction,
  discordId: string,
  discordUsername: string | null,
) {
  if (commandName === "help") return handleHelp();
  if (commandName === "claim") {
    const code = interactionOptionString(interaction, "code")?.toUpperCase() ?? "";
    if (!code) return { text: "Usage: /claim code:RHAG-XXXXXXXXXX" };
    return handleClaim(code, discordId, discordUsername);
  }
  if (commandName === "unlink") return handleUnlink(discordId);

  const agent = findAgentByDiscordOwner(discordId);
  if (commandName === "status") return agent ? handleStatus(agent) : noAgentLinkedReply();
  if (commandName === "trades") return agent ? handleTrades(agent) : noAgentLinkedReply();
  if (commandName === "posts") return agent ? handlePosts(agent) : noAgentLinkedReply();
  if (commandName === "post") {
    const text = interactionOptionString(interaction, "text") ?? "";
    return agent ? handlePost(agent, text) : noAgentLinkedReply();
  }
  return { text: `Unknown command. ${handleHelp().text}` };
}

async function handleAskAsync(
  text: string,
  discordId: string,
  discordUsername: string | null,
  interactionToken: string,
): Promise<void> {
  try {
    const agent = findAgentByDiscordOwner(discordId);
    const out = await routeNaturalLanguage(text, agent, discordId, discordUsername);
    await sendDiscordFollowup(interactionToken, out);
  } catch (err) {
    console.error("[discord/interactions] /ask failed", err);
    await sendDiscordFollowup(interactionToken, "Something went wrong — try /help for commands.");
  }
}
