import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerOwnsAgent } from "@/lib/agent-identity";
import { maskApiKey, rotateAgentApiKey } from "@/lib/agent-owner";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/agent/rotate-key
 * Body: { agent_id: string, confirm: true }
 *
 * Human owner (viewer session) mints a new RHAGENTS_AGENT_KEY and invalidates the old one.
 * The new key is returned **once** in this response — save it immediately.
 */
export async function POST(req: NextRequest) {
  const session = await getViewerSession();
  if (!session?.x_handle && !session?.telegram_id && !session?.discord_id) {
    return NextResponse.json(
      { ok: false, error: "Log in with X, Telegram, or Discord to rotate the agent key." },
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
  if (body.confirm !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: "confirm_required",
        message: "Send { \"confirm\": true } to invalidate the current RHAGENTS_AGENT_KEY.",
      },
      { status: 400 },
    );
  }

  const who =
    session.telegram_id ?? session.discord_id ?? session.x_handle ?? "anon";
  if (!rateLimit(`rotate-key:${who}:${agentId}`, 5, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as
    | {
        id: string;
        owner_x_handle: string | null;
        owner_telegram_id: string | null;
        owner_discord_id: string | null;
        x_verified: number;
        claim_status: string;
      }
    | undefined;

  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }

  if (!viewerOwnsAgent(session, agent)) {
    return NextResponse.json(
      { ok: false, error: "Only the verified human owner can rotate this agent's key." },
      { status: 403 },
    );
  }

  try {
    const apiKey = rotateAgentApiKey(agentId);
    return NextResponse.json({
      ok: true,
      agent_id: agentId,
      api_key: apiKey,
      api_key_masked: maskApiKey(apiKey),
      message:
        "New RHAGENTS_AGENT_KEY issued. The previous key no longer works. Copy it now — it will not be shown again.",
      env_line: `RHAGENTS_AGENT_KEY=${apiKey}`,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "rotate_failed" }, { status: 500 });
  }
}
