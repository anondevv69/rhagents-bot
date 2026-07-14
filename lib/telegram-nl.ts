/**
 * Free-text Telegram messages → Claude tool-use → one of a small fixed set of account actions.
 * Scoped entirely to the agent linked to the sender's telegram_id — the model picks a tool,
 * we execute it with our own code (never lets the model touch the DB or call arbitrary APIs).
 */
import type { Agent } from "./db";
import { handleClaim, handleHelp, handlePost, handlePosts, handleStatus, handleTrades, handleUnlink } from "./telegram-bot";

function anthropicKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k && k.length > 10 ? k : null;
}

function model(): string {
  return process.env.TELEGRAM_NL_MODEL?.trim() || "claude-haiku-4-5-20251001";
}

const TOOLS = [
  {
    name: "get_status",
    description: "Show the linked agent's claim status, capability, reputation, followers, and profile link.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_trades",
    description: "List the agent's most recent trade posts (buys/sells).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_posts",
    description: "List the agent's most recent general/research posts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_post",
    description: "Publish a new general post to the feed as the agent, e.g. a research note or update.",
    input_schema: {
      type: "object",
      properties: { body: { type: "string", description: "Post text, max 1000 chars." } },
      required: ["body"],
    },
  },
  {
    name: "claim_agent",
    description: "Claim/link a newly-registered agent using its RHAG-… claim code.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", description: "Claim code, format RHAG-XXXXXXXXXX." } },
      required: ["code"],
    },
  },
  {
    name: "unlink",
    description: "Remove this Telegram account's management access to its linked agent.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "help",
    description: "Explain what this bot can do.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

interface AnthropicToolUseBlock {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
}
interface AnthropicTextBlock {
  type: "text";
  text: string;
}

async function callClaude(userText: string, hasAgent: boolean): Promise<
  { text?: string; tool?: string; toolInput?: Record<string, unknown> } | null
> {
  const key = anthropicKey();
  if (!key) return null;

  const system = [
    "You are the rhagent.bot Telegram assistant. The user is a human who manages an AI trading",
    "agent account on rhagent.bot. Pick exactly one tool that matches their request, or reply with",
    "plain text if nothing matches (e.g. small talk). Never invent data — tools return the real data.",
    hasAgent ? "This user already has a linked agent." : "This user has NO linked agent yet — steer them toward claim_agent or help.",
  ].join(" ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model(),
        max_tokens: 300,
        system,
        tools: TOOLS,
        messages: [{ role: "user", content: userText.slice(0, 2000) }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("[telegram-nl] Anthropic error", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { content: Array<AnthropicToolUseBlock | AnthropicTextBlock> };
    const toolUse = data.content.find((b): b is AnthropicToolUseBlock => b.type === "tool_use");
    if (toolUse) return { tool: toolUse.name, toolInput: toolUse.input };
    const textBlock = data.content.find((b): b is AnthropicTextBlock => b.type === "text");
    return { text: textBlock?.text };
  } catch (err) {
    console.error("[telegram-nl] Anthropic call failed", err);
    return null;
  }
}

export async function routeNaturalLanguage(
  text: string,
  agent: Agent | null,
  telegramId: string,
  telegramUsername: string | null,
): Promise<string> {
  const routed = await callClaude(text, !!agent);
  if (!routed) {
    return "I can't parse free text right now (natural-language mode isn't configured) — try /help for commands.";
  }
  if (routed.text) return routed.text.slice(0, 4000);

  switch (routed.tool) {
    case "get_status":
      return agent ? handleStatus(agent).text : "No agent linked yet — send /claim RHAG-XXXXXXXXXX first.";
    case "list_trades":
      return agent ? handleTrades(agent).text : "No agent linked yet — send /claim RHAG-XXXXXXXXXX first.";
    case "list_posts":
      return agent ? handlePosts(agent).text : "No agent linked yet — send /claim RHAG-XXXXXXXXXX first.";
    case "create_post": {
      const body = typeof routed.toolInput?.body === "string" ? routed.toolInput.body : "";
      return agent ? handlePost(agent, body).text : "No agent linked yet — send /claim RHAG-XXXXXXXXXX first.";
    }
    case "claim_agent": {
      const code = typeof routed.toolInput?.code === "string" ? routed.toolInput.code : "";
      return code ? handleClaim(code, telegramId, telegramUsername).text : "Send your RHAG-… claim code.";
    }
    case "unlink":
      return handleUnlink(telegramId).text;
    case "help":
    default:
      return handleHelp().text;
  }
}
