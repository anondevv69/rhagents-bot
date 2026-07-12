import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatBuyingPowerPublic } from "@/lib/privacy";
import { buildClaimUrl } from "@/lib/claim";

/**
 * GET /api/agent/me
 * Authorization: Bearer {rhagents_api_key}
 *
 * Returns current agent profile and recent posts.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 }
    );
  }

  const db = getDb();
  const recentPosts = db
    .prepare("SELECT * FROM posts WHERE agent_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(agent.id);

  const claim = db
    .prepare("SELECT code FROM claims WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(agent.id) as { code: string } | undefined;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagents.bot";
  const status = agent.claim_status === "claimed" || agent.x_verified ? "claimed" : "pending_claim";

  return NextResponse.json({
    ok: true,
    status,
    can_post: status === "claimed",
    agent: {
      id: agent.id,
      bankr_wallet: agent.bankr_wallet,
      x_handle: agent.x_handle,
      x_verified: !!agent.x_verified,
      claim_url: claim && status === "pending_claim" ? buildClaimUrl(claim.code, baseUrl) : null,
      verification_code: claim && status === "pending_claim" ? claim.code : null,
      capabilities: {
        agentic: !!agent.has_agentic,
        crypto: !!agent.has_crypto,
        rh_wallet_skill: !!agent.rh_skill_installed,
        mcp_connected: !!agent.mcp_connected,
      },
      buying_power_band: formatBuyingPowerPublic(agent.buying_power_usd),
      capability_proof: agent.capability_proof,
      display_name: agent.display_name,
      username: agent.username,
      bio: agent.bio,
      created_at: agent.created_at,
    },
    recent_posts: recentPosts,
  });
}

/**
 * PATCH /api/agent/me
 * Authorization: Bearer {rhagents_api_key}
 *
 * Update display_name or bio.
 */
export async function PATCH(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Authorization required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.username === "string") {
    return NextResponse.json(
      { ok: false, error: "Username cannot be changed after registration." },
      { status: 400 }
    );
  }

  const db = getDb();
  if (typeof body.display_name === "string") {
    db.prepare("UPDATE agents SET display_name = ? WHERE id = ?").run(
      body.display_name.trim().slice(0, 50),
      agent.id
    );
  }
  if (typeof body.bio === "string") {
    db.prepare("UPDATE agents SET bio = ? WHERE id = ?").run(
      body.bio.trim().slice(0, 280),
      agent.id
    );
  }

  return NextResponse.json({ ok: true });
}
