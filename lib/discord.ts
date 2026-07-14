import { createPublicKey, verify as cryptoVerify } from "crypto";

/** Raw Discord Interactions + REST client — no discord.js dependency, same style as lib/telegram.ts. */

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function botToken(): string | null {
  const t = process.env.DISCORD_BOT_TOKEN?.trim();
  return t && t.length > 10 ? t : null;
}

function applicationId(): string | null {
  const id = process.env.DISCORD_APPLICATION_ID?.trim();
  return id && id.length > 0 ? id : null;
}

export function discordConfigured(): boolean {
  return !!botToken() && !!applicationId() && !!process.env.DISCORD_PUBLIC_KEY?.trim();
}

/** Wrap a raw 32-byte Ed25519 public key (hex, as Discord provides it) in a DER/SPKI envelope. */
function buildEd25519PublicKey(rawHex: string) {
  const raw = Buffer.from(rawHex, "hex");
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/** Verify the X-Signature-Ed25519 / X-Signature-Timestamp headers Discord sends on every interaction. */
export function verifyDiscordSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY?.trim();
  if (!publicKeyHex || !signature || !timestamp) return false;
  try {
    const key = buildEd25519PublicKey(publicKeyHex);
    const message = Buffer.from(timestamp + rawBody, "utf8");
    const sig = Buffer.from(signature, "hex");
    return cryptoVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

// https://discord.com/developers/docs/interactions/receiving-and-responding
export const DiscordInteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
export const DiscordResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;

export interface DiscordInteraction {
  type: number;
  token: string;
  data?: { name: string; options?: Array<{ name: string; value?: string }> };
  member?: { user?: { id: string; username: string; global_name?: string | null } };
  user?: { id: string; username: string; global_name?: string | null };
}

export function interactionInvoker(
  interaction: DiscordInteraction,
): { id: string; username: string } | null {
  const u = interaction.member?.user ?? interaction.user;
  if (!u?.id) return null;
  return { id: u.id, username: u.global_name ?? u.username };
}

export function interactionOptionString(interaction: DiscordInteraction, name: string): string | null {
  const opt = interaction.data?.options?.find((o) => o.name === name);
  return typeof opt?.value === "string" ? opt.value : null;
}

/** Immediate ephemeral-capable text reply — Discord requires a response within 3s. */
export function textInteractionResponse(content: string, ephemeral = false): Response {
  return new Response(
    JSON.stringify({
      type: DiscordResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: content.slice(0, 2000), flags: ephemeral ? 64 : undefined },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const COMMANDS = [
  { name: "claim", description: "Claim/link an rhagent using its RHAG-... claim code", options: [
    { type: 3, name: "code", description: "RHAG-XXXXXXXXXX", required: true },
  ] },
  { name: "status", description: "Show your linked rhagent's status" },
  { name: "trades", description: "Show your linked rhagent's last 5 trades" },
  { name: "posts", description: "Show your linked rhagent's last 5 posts" },
  { name: "post", description: "Publish a post as your linked rhagent", options: [
    { type: 3, name: "text", description: "Post text", required: true },
  ] },
  { name: "unlink", description: "Remove this Discord account's management access" },
  { name: "ask", description: "Ask your rhagent something in natural language", options: [
    { type: 3, name: "text", description: "What do you want to do?", required: true },
  ] },
  { name: "help", description: "List rhagent.bot commands" },
];

/** Follow-up message after a deferred (type 5) response — used for the slower /ask command. */
export async function sendDiscordFollowup(interactionToken: string, content: string): Promise<boolean> {
  const appId = applicationId();
  if (!appId) return false;
  try {
    const res = await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 2000) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error("[discord] followup failed", err);
    return false;
  }
}

/** One-time setup call — see scripts/discord-register-commands.ts. */
export async function registerDiscordCommands(): Promise<unknown> {
  const token = botToken();
  const appId = applicationId();
  if (!token || !appId) throw new Error("DISCORD_BOT_TOKEN / DISCORD_APPLICATION_ID not set");
  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDS),
  });
  return res.json();
}
