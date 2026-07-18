import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { createTelegramOwnerLink } from "@/lib/owner-link";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { siteTelegramBotUsername } from "@/lib/telegram-bots";

/**
 * POST /api/agent/link-telegram
 * Body: { agent_id: string }
 *
 * Owner session mints a one-time RHTG-… code for the Telegram bot
 * (same bot as /website — claim + hosted agent).
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in to generate a Telegram link code." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const agentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`link-tg:${who}:${agentId}`, 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as
    | {
        id: string;
        owner_x_handle: string | null;
        owner_telegram_id: string | null;
        owner_discord_id: string | null;
        chain_wallet: string | null;
        x_verified: number;
        claim_status: string;
      }
    | undefined;

  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  if (!viewerOwnsAgent(session, agent)) {
    return NextResponse.json({ ok: false, error: "Only the verified owner can link Telegram." }, { status: 403 });
  }
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
