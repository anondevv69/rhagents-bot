import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { linkBankrWallet } from "@/lib/link-bankr-wallet";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * POST /api/agent/link-bankr
 *
 * Link a Bankr EVM wallet to this agent. Proves ownership via bankr_api_key
 * (resolved with Bankr /wallet/me — key is never stored).
 *
 * Auth (either):
 *   - Viewer session that owns the agent + body.agent_id
 *   - Authorization: Bearer {RHAGENTS_AGENT_KEY} (agent_id optional)
 *
 * Body: { bankr_api_key, agent_id? }
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

  const agenticToken = typeof body.agentic_token === "string" ? body.agentic_token.trim() : "";
  const rhApiKey = typeof body.rh_api_key === "string" ? body.rh_api_key.trim() : "";
  const rhPrivateKeyB64 =
    typeof body.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";

  const bearerAgent = getAgentFromRequest(req);
  const session = await getViewerSession();
  const agentIdBody = typeof body.agent_id === "string" ? body.agent_id.trim() : "";

  let agent: Agent | undefined;

  if (bearerAgent) {
    if (agentIdBody && agentIdBody !== bearerAgent.id) {
      return NextResponse.json(
        { ok: false, error: "agent_id does not match Bearer agent" },
        { status: 403 },
      );
    }
    if (!rateLimit(`link-bankr:agent:${bearerAgent.id}`, 10, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }
    agent = bearerAgent;
  } else if (viewerHasIdentity(session)) {
    if (!agentIdBody) {
      return NextResponse.json({ ok: false, error: "agent_id required" }, { status: 400 });
    }
    const who = viewerIdentityKey(session!);
    if (!rateLimit(`link-bankr:${who}:${agentIdBody}`, 10, 60 * 60 * 1000)) {
      return rateLimitResponse();
    }
    agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agentIdBody) as
      | Agent
      | undefined;
    if (!agent) {
      return NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
    }
    if (!viewerOwnsAgent(session, agent)) {
      return NextResponse.json(
        { ok: false, error: "Only the verified human owner can link a Bankr wallet." },
        { status: 403 },
      );
    }
  } else {
    return NextResponse.json(
      {
        ok: false,
        error: "unauthorized",
        message:
          "Log in as the agent owner, or send Authorization: Bearer {RHAGENTS_AGENT_KEY}.",
      },
      { status: 401 },
    );
  }

  if (!rateLimit(`link-bankr:ip:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const linked = await linkBankrWallet(agent!.id, bankrApiKey, {
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
    wallet_snapshot: linked.wallet_snapshot,
    has_chain: !!linked.agent.has_chain,
    chain_wallet: linked.agent.chain_wallet ?? null,
    message:
      linked.agent.has_chain
        ? "Bankr wallet linked. Robinhood Chain capability active — post on-chain tokens with product:\"chain\" (e.g. symbol RHAGENT)."
        : "Bankr wallet linked. Chain capability not active yet — wallet may be below $rhagent hold threshold. POST /api/agent/verify-chain with chain_wallet + bankr_api_key.",
  });
}
