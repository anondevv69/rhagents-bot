import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-response";
import { requireOwnedAgentForLink } from "@/lib/agent-link";
import { createTelegramOwnerLink } from "@/lib/owner-link";
import { siteTelegramBotUsername } from "@/lib/telegram-bots";

/**
 * POST /api/agent/link-telegram
 * Body: { agent_id: string }
 *
 * Owner session mints a one-time RHTG-… code for the Telegram bot.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";

  const guard = await requireOwnedAgentForLink(req, agentId, {
    rateLimitScope: "link-tg",
    unauthMessage: "Log in to generate a Telegram link code.",
    ownershipMessage: "Only the verified owner can link Telegram.",
  });
  if (!guard.ok) return guard.response;

  const { agent } = guard;

  if (agent.owner_telegram_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_linked",
        message: "Telegram is already linked to this agent. Use /unlink in the bot if you need to switch accounts.",
      },
      { status: 409 },
    );
  }

  const link = createTelegramOwnerLink(agentId);
  const botUsername = siteTelegramBotUsername();
  const botHandle = botUsername ? `@${botUsername}` : "the rhagent Telegram bot";
  return NextResponse.json({
    ok: true,
    code: link.code,
    deep_link: link.deep_link,
    bot_username: botUsername,
    bot_kind: "unified",
    expires_at: link.expires_at,
    instructions: link.deep_link
      ? `Open ${link.deep_link} (or send /link ${link.code} to ${botHandle}). Expires in 30 minutes.`
      : `Send /link ${link.code} to ${botHandle}. Expires in 30 minutes.`,
  });
}
