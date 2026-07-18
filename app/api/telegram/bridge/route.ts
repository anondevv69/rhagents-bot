import { NextRequest, NextResponse } from "next/server";
import { bridgeSecretOk } from "@/lib/telegram-bridge-auth";
import { markTelegramVerified } from "@/lib/telegram-viewer";
import { findAgentByTelegramOwner, unlinkTelegramOwner, verifyTelegramClaim } from "@/lib/telegram-claim";
import { parseOwnerLinkCode, redeemTelegramOwnerLink } from "@/lib/owner-link";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { getFollowerCount, getAgentReputation } from "@/lib/social";
import { agentProfilePath, agentProfileSlug } from "@/lib/agent-path";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type BridgeBody = {
  action?: string;
  telegram_id?: string;
  telegram_username?: string | null;
  code?: string;
};

/**
 * POST /api/telegram/bridge
 * Header: X-Telegram-Bridge-Secret (TELEGRAM_BRIDGE_SECRET on both services)
 *
 * Lets the single trading Telegram bot verify website login (RHVIEW), claim (RHAG),
 * and link ownership (RHTG) against rhagentsite's DB without owning a second BotFather bot.
 */
export async function POST(req: NextRequest) {
  if (!bridgeSecretOk(req.headers.get("x-telegram-bridge-secret"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: BridgeBody;
  try {
    body = (await req.json()) as BridgeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const telegramId = typeof body.telegram_id === "string" ? body.telegram_id.trim() : "";
  const telegramUsername =
    typeof body.telegram_username === "string" && body.telegram_username.trim()
      ? body.telegram_username.trim().replace(/^@/, "")
      : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!telegramId) {
    return NextResponse.json({ ok: false, error: "telegram_id required" }, { status: 400 });
  }
  if (!rateLimit(`tg-bridge:${action}:${telegramId}`, 30, 60 * 1000)) {
    return rateLimitResponse();
  }

  switch (action) {
    case "viewer_verify": {
      if (!code.toUpperCase().startsWith("RHVIEW-")) {
        return NextResponse.json({ ok: false, error: "Expected RHVIEW-… code" }, { status: 400 });
      }
      const ok = markTelegramVerified(code, telegramId, telegramUsername);
      return NextResponse.json(
        ok
          ? {
              ok: true,
              message: "Verified! Go back to the rhagent.bot tab — you should be signed in.",
            }
          : {
              ok: false,
              error: "Login code expired or already used. Start again from /login on rhagent.bot.",
            },
        { status: ok ? 200 : 400 },
      );
    }

    case "claim": {
      if (!code) {
        return NextResponse.json({ ok: false, error: "Usage: /claim RHAG-XXXXXXXXXX" }, { status: 400 });
      }
      const result = verifyTelegramClaim(code, telegramId, telegramUsername);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error ?? "claim failed" }, { status: 400 });
      }
      const name = result.agent_name ?? "Your agent";
      return NextResponse.json({
        ok: true,
        already: Boolean(result.already),
        agent_id: result.agent_id,
        message: result.already
          ? `${name} is already claimed by this Telegram account.`
          : `Claimed! ${name} is now linked to this Telegram account.`,
      });
    }

    case "link": {
      const linkCode = parseOwnerLinkCode(code) ?? (code.toUpperCase().startsWith("RHTG-") ? code.toUpperCase() : null);
      if (!linkCode) {
        return NextResponse.json(
          { ok: false, error: "Usage: /link RHTG-XXXXXXXXXX (from Agent Settings on rhagent.bot)" },
          { status: 400 },
        );
      }
      const result = redeemTelegramOwnerLink(linkCode, telegramId, telegramUsername);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error ?? "link failed" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        already: Boolean(result.already),
        agent_id: result.agent_id,
        message: result.already
          ? "Telegram is already linked to this agent."
          : `Linked! ${result.agent_name ?? "Your agent"} can be managed from this Telegram account.`,
      });
    }

    case "unlink": {
      const ok = unlinkTelegramOwner(telegramId);
      return NextResponse.json({
        ok: true,
        message: ok
          ? "Unlinked. This Telegram account no longer manages any rhagent on the site."
          : "Nothing was linked to this Telegram account on the site.",
      });
    }

    case "owner_status": {
      const agent = findAgentByTelegramOwner(telegramId);
      if (!agent) {
        return NextResponse.json({
          ok: true,
          linked: false,
          message: "No rhagent.bot profile ownership linked to this Telegram yet.",
        });
      }
      const slug = agentProfileSlug(agent);
      const base = getSiteBaseUrl();
      const followers = getFollowerCount(agent.id);
      const rep = getAgentReputation(agent.id);
      return NextResponse.json({
        ok: true,
        linked: true,
        agent_id: agent.id,
        username: slug,
        display_name: agent.display_name,
        claim_status: agent.claim_status,
        profile_url: `${base}${agentProfilePath(agent)}`,
        followers,
        reputation: rep,
        message: [
          `Agent: ${agent.display_name ?? slug} (@${slug})`,
          `Status: ${agent.claim_status}`,
          `Followers: ${followers} · Reputation: ${rep}`,
          `Profile: ${base}${agentProfilePath(agent)}`,
        ].join("\n"),
      });
    }

    default:
      return NextResponse.json(
        { ok: false, error: "Unknown action. Use viewer_verify | claim | link | unlink | owner_status" },
        { status: 400 },
      );
  }
}
