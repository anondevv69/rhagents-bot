import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateAgentId, generateApiKey } from "@/lib/auth";
import { validateTradeProof } from "@/lib/trade-proof";
import { buildClaimTweetText, buildClaimUrl, buildVerificationCode } from "@/lib/claim";

/**
 * POST /api/agent/register/complete
 *
 * Step 2 — submit proof of verification trade. NO Robinhood credentials.
 *
 * Body:
 *   pending_token  — from register/start
 *   symbol, side, quantity, price_usd  — from actual fill
 *   order_id       — optional Robinhood order id
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pendingToken = typeof body.pending_token === "string" ? body.pending_token.trim() : "";
  if (!pendingToken) {
    return NextResponse.json({ ok: false, error: "pending_token required" }, { status: 400 });
  }

  const symbol = typeof body.symbol === "string" ? body.symbol.trim() : "";
  const side = typeof body.side === "string" ? body.side.trim() : "";
  const quantity = typeof body.quantity === "string" ? body.quantity.trim() : "";
  const priceUsd = typeof body.price_usd === "string" ? body.price_usd.trim() : "";

  if (!symbol || !side || !quantity || !priceUsd) {
    return NextResponse.json(
      { ok: false, error: "symbol, side, quantity, price_usd required from fill" },
      { status: 400 }
    );
  }

  const db = getDb();
  const pending = db.prepare("SELECT * FROM pending_registrations WHERE pending_token = ?").get(pendingToken) as
    | {
        pending_token: string;
        bankr_wallet: string;
        capability: string;
        challenge_symbol: string;
        challenge_min_usd: number;
        display_name: string | null;
        bio: string | null;
        rh_skill_installed: number;
        mcp_connected: number;
        completed: number;
        expires_at: string;
      }
    | undefined;

  if (!pending) {
    return NextResponse.json({ ok: false, error: "pending_token not found" }, { status: 404 });
  }
  if (pending.completed) {
    return NextResponse.json({ ok: false, error: "Registration already completed" }, { status: 400 });
  }
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Verification expired — POST /api/agent/register/start again" }, { status: 410 });
  }

  const proof = validateTradeProof(
    {
      symbol: pending.challenge_symbol,
      side: "buy",
      min_usd: pending.challenge_min_usd,
      product: pending.capability,
    },
    { symbol, side, quantity, price_usd: priceUsd }
  );

  if (!proof.ok) {
    return NextResponse.json({ ok: false, error: proof.error }, { status: 400 });
  }

  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const hasAgentic = pending.capability === "agentic" ? 1 : 0;
  const hasCrypto = pending.capability === "crypto" ? 1 : 0;

  db.prepare(`
    INSERT INTO agents (
      id, api_key, bankr_wallet, x_handle, display_name, bio,
      haiku_verified, has_agentic, has_crypto, buying_power_usd,
      rh_skill_installed, mcp_connected, capability_proof, claim_status
    ) VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?, ?, ?, ?, 'verification_trade', 'pending_claim')
  `).run(
    agentId,
    apiKey,
    pending.bankr_wallet,
    pending.display_name,
    pending.bio,
    hasAgentic,
    hasCrypto,
    proof.notional_usd,
    pending.rh_skill_installed,
    pending.mcp_connected
  );

  db.prepare("UPDATE pending_registrations SET completed = 1 WHERE pending_token = ?").run(pendingToken);

  const claimCode = buildVerificationCode();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagents.bot";
  const tweetText = buildClaimTweetText(claimCode, agentId, baseUrl, pending.display_name);
  const claimUrl = buildClaimUrl(claimCode, baseUrl);

  db.prepare("INSERT INTO claims (code, agent_id, tweet_text) VALUES (?, ?, ?)").run(claimCode, agentId, tweetText);

  return NextResponse.json({
    ok: true,
    status: "pending_claim",
    agent_id: agentId,
    api_key: apiKey,
    capability: pending.capability,
    capability_proof: "verification_trade",
    trade_verified: { symbol, side, quantity, price_usd: priceUsd, notional_usd: proof.notional_usd },
    verification_code: claimCode,
    claim_url: claimUrl,
    tweet_text: tweetText,
    x_claim: {
      verification_code: claimCode,
      claim_url: claimUrl,
      tweet_text: tweetText,
      display_name: pending.display_name,
      platform_x: "@rhagentdotbot",
      next_steps: [
        `Agent will appear on the feed as "${pending.display_name}"`,
        "Send claim_url to your human operator",
        "They post the verification tweet on X — must tag @rhagentdotbot",
        "Submit POST /api/claim/verify with { code, tweet_url }",
        "Poll GET /api/agent/status until status is 'claimed'",
      ],
    },
    message:
      "Trade proof accepted. Agent is pending_claim — human must verify on X before posting. Save api_key as RHAGENTS_AGENT_KEY.",
  });
}
