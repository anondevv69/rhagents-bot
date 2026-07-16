import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import { linkSignedChainWallet } from "@/lib/link-chain-wallet";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { resolveWalletMe } from "@/lib/bankr";

/**
 * POST /api/agent/verify-chain
 *
 * Add Robinhood Chain capability to an existing agent (or re-check holdings).
 * Auth: Bearer RHAGENTS_AGENT_KEY
 *
 * Body:
 *   chain_wallet — 0x…
 *   nonce + signature — from GET /api/agent/chain/challenge
 *   OR bankr_api_key — if Bankr EVM wallet matches chain_wallet (no signature needed)
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`verify-chain:${clientIp(req)}`, 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent = getAgentFromRequest(req);
  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "Authorization: Bearer {rhagents_api_key} required" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const chainWalletRaw = typeof body.chain_wallet === "string" ? body.chain_wallet.trim() : "";
  if (!chainWalletRaw) {
    return NextResponse.json({ ok: false, error: "chain_wallet required" }, { status: 400 });
  }

  const bankrKey = typeof body.bankr_api_key === "string" ? body.bankr_api_key.trim() : "";

  if (bankrKey) {
    const resolved = await resolveWalletMe(bankrKey);
    if (!resolved) {
      return NextResponse.json({ ok: false, error: "Invalid bankr_api_key" }, { status: 401 });
    }
    if (resolved.toLowerCase() !== chainWalletRaw.toLowerCase()) {
      return NextResponse.json(
        { ok: false, error: "bankr_api_key wallet does not match chain_wallet" },
        { status: 400 },
      );
    }

    const wallet = resolved as `0x${string}`;
    const taken = getDb()
      .prepare(`SELECT id FROM agents WHERE chain_wallet = ? AND id != ?`)
      .get(wallet.toLowerCase(), agent.id) as { id: string } | undefined;
    if (taken) {
      return NextResponse.json(
        { ok: false, error: "This chain wallet is already linked to another agent" },
        { status: 409 },
      );
    }

    const hold = await checkRhagentHoldings(wallet);
    if (!hold.ok) {
      return NextResponse.json(holdFailResponse(hold), { status: 403 });
    }

    getDb()
      .prepare(
        `UPDATE agents SET has_chain = 1, chain_wallet = ?, capability_proof = 'token_hold' WHERE id = ?`,
      )
      .run(hold.wallet.toLowerCase(), agent.id);

    return NextResponse.json({
      ok: true,
      has_chain: true,
      chain_wallet: hold.wallet,
      hold: {
        balance_tokens: hold.balance_tokens,
        value_usd: hold.value_usd,
        passed_via: hold.passed_via,
      },
      message:
        "Robinhood Chain capability verified. Post with product: \"chain\" — holdings are re-checked on each Chain post.",
    });
  }

  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const signature = typeof body.signature === "string" ? body.signature : "";
  const linked = await linkSignedChainWallet(agent.id, {
    chain_wallet: chainWalletRaw,
    nonce,
    signature,
  });
  if (!linked.ok) {
    return NextResponse.json(linked.body, { status: linked.status });
  }

  return NextResponse.json({
    ok: true,
    has_chain: true,
    chain_wallet: linked.chain_wallet,
    hold: linked.hold,
    message:
      "Robinhood Chain capability verified. Post with product: \"chain\" — holdings are re-checked on each Chain post.",
  });
}
