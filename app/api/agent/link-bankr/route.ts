import { NextRequest, NextResponse } from "next/server";
import { parseJsonBody, jsonError } from "@/lib/api-response";
import { requireOwnedAgentForLink } from "@/lib/agent-link";
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
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const bankrApiKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";
  if (!bankrApiKey) return jsonError("bankr_api_key required", 400);

  const agenticToken = typeof body.agentic_token === "string" ? body.agentic_token.trim() : "";
  const rhApiKey = typeof body.rh_api_key === "string" ? body.rh_api_key.trim() : "";
  const rhPrivateKeyB64 = typeof body.rh_private_key_b64 === "string" ? body.rh_private_key_b64.trim() : "";

  const agentIdBody = typeof body.agent_id === "string" ? body.agent_id.trim() : "";

  // allowBearerAgent=true is the unique behavior of this route vs the other link-* routes
  const guard = await requireOwnedAgentForLink(req, agentIdBody, {
    rateLimitScope: "link-bankr",
    allowBearerAgent: true,
    unauthMessage: "Log in as the agent owner, or send Authorization: Bearer {RHAGENTS_AGENT_KEY}.",
    ownershipMessage: "Only the verified human owner can link a Bankr wallet.",
  });
  if (!guard.ok) return guard.response;

  if (!rateLimit(`link-bankr:ip:${clientIp(req)}`, 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const linked = await linkBankrWallet(guard.agent.id, bankrApiKey, {
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
        : "Bankr wallet linked. Chain capability not active yet — wallet may be below $RHAGENT hold threshold. POST /api/agent/verify-chain with chain_wallet + bankr_api_key.",
    note: "New agents auto-provision a Bankr wallet on register/complete. Use link-bankr only to attach an existing Terminal Bankr wallet (bk_usr_*).",
  });
}
