import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { createXOwnerLink } from "@/lib/owner-link";
import { PLATFORM_X_HANDLE } from "@/lib/claim";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/agent/link-x
 * Body: { agent_id }
 *
 * Mint a one-time RHX-… code + tweet text so a wallet (or TG) owner can attach X.
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in to generate an X link code." },
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
  if (!rateLimit(`link-x:${who}:${agentId}`, 10, 60 * 60 * 1000)) {
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
    return NextResponse.json({ ok: false, error: "Only the verified owner can link X." }, { status: 403 });
  }
  if (agent.owner_x_handle && agent.x_verified) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_linked",
        message: `X is already linked as @${agent.owner_x_handle.replace(/^@/, "")}.`,
      },
      { status: 409 },
    );
  }

  const link = createXOwnerLink(agentId);
  const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(link.tweet_text)}`;

  return NextResponse.json({
    ok: true,
    code: link.code,
    tweet_text: link.tweet_text,
    tweet_intent_url: intent,
    expires_at: link.expires_at,
    platform_x: `@${PLATFORM_X_HANDLE}`,
    instructions: [
      `1. Post this tweet (must tag @${PLATFORM_X_HANDLE} and include ${link.code})`,
      "2. Copy the tweet URL",
      "3. Submit it via POST /api/agent/link-x/verify { agent_id, code, tweet_url }",
    ],
  });
}
