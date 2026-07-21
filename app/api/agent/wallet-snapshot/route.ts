import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerOwnsAgent } from "@/lib/agent-identity";
import { linkBankrWallet } from "@/lib/link-bankr-wallet";
import { parseStoredWalletSnapshot } from "@/lib/wallet-snapshot";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

async function resolveAgent(req: NextRequest, agentIdBody: string): Promise<Agent | NextResponse> {
  const bearerAgent = getAgentFromRequest(req);
  const session = await getViewerSession();

  if (bearerAgent) {
    if (agentIdBody && agentIdBody !== bearerAgent.id) {
      return NextResponse.json(
        { ok: false, error: "agent_id does not match Bearer agent" },
        { status: 403 },
      );
    }
    return bearerAgent;
  }

  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Log in as the agent owner." },
      { status: 401 },
    );
  }

  if (!agentIdBody) {
    return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
  }

  const agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agentIdBody) as
    | Agent
    | undefined;
  if (!agent) {
    return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
  }
  if (!viewerOwnsAgent(session, agent)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return agent;
}

/** GET /api/agent/wallet-snapshot?agent_id= — last saved snapshot (no secrets). */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent_id")?.trim() ?? "";
  const agent = await resolveAgent(req, agentId);
  if (agent instanceof NextResponse) return agent;

  const snapshot = parseStoredWalletSnapshot(agent.bankr_wallet_snapshot);
  return NextResponse.json({
    ok: true,
    bankr_wallet: agent.bankr_wallet,
    fetched_at: agent.bankr_wallet_snapshot_at,
    snapshot,
    note: "Balances are from the last Bankr key refresh — keys are never stored.",
  });
}

/**
 * POST /api/agent/wallet-snapshot
 * Body: { agent_id?, bankr_api_key, agentic_token?, rh_api_key?, rh_private_key_b64? }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const bankrApiKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (!bankrApiKey) {
    return NextResponse.json({ ok: false, error: "bankr_api_key required" }, { status: 400 });
  }

  const agentIdBody = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  const agent = await resolveAgent(req, agentIdBody);
  if (agent instanceof NextResponse) return agent;

  if (!rateLimit(`wallet-snapshot:${agent.id}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }
  if (!rateLimit(`wallet-snapshot:ip:${clientIp(req)}`, 40, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agenticToken = typeof body.agentic_token === "string" ? body.agentic_token.trim() : "";
  const rhApiKey = typeof body.rh_api_key === "string" ? body.rh_api_key.trim() : "";
  const rhPrivateKeyB64 =
    typeof body.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";

  const linked = await linkBankrWallet(agent.id, bankrApiKey, {
    agenticToken: agenticToken || undefined,
    rhApiKey: rhApiKey || undefined,
    rhPrivateKeyB64: rhPrivateKeyB64 || undefined,
  });

  if (!linked.ok) {
    return NextResponse.json(linked.body, { status: linked.status });
  }

  return NextResponse.json({
    ok: true,
    bankr_wallet: linked.bankr_wallet,
    snapshot: linked.wallet_snapshot,
    message:
      "Portfolio snapshot updated. Bankr API key was not stored. Optional Robinhood creds were used once and discarded.",
  });
}
