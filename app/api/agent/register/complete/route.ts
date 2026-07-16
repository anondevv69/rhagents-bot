import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateAgentId, generateApiKey } from "@/lib/auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { validateTradeProof } from "@/lib/trade-proof";
import { buildClaimTweetText, buildClaimUrl, buildVerificationCode } from "@/lib/claim";
import { buildHumanClaimHandoffMessage } from "@/lib/claim-handoff";
import { slugifyUsername, validateUsername, isUsernameTaken, USERNAME_PERMANENT_NOTICE } from "@/lib/username";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";

/**
 * POST /api/agent/register/complete
 *
 * App path: pending_token + fill proof (symbol, side, quantity, price_usd)
 * Chain path: pending_token only — re-checks $rhagent balance on linked wallet
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`register-complete:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

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

  const db = getDb();
  const pending = db.prepare("SELECT * FROM pending_registrations WHERE pending_token = ?").get(pendingToken) as
    | {
        pending_token: string;
        bankr_wallet: string | null;
        chain_wallet: string | null;
        capability: string;
        challenge_symbol: string;
        challenge_min_usd: number;
        display_name: string | null;
        username: string | null;
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
    return NextResponse.json(
      { ok: false, error: "Verification expired — POST /api/agent/register/start again" },
      { status: 410 }
    );
  }

  const isChain = pending.capability === "chain";
  let notionalUsd = 0;
  let tradeVerified: Record<string, unknown> | null = null;
  let holdVerified: Record<string, unknown> | null = null;

  if (isChain) {
    if (!pending.chain_wallet) {
      return NextResponse.json({ ok: false, error: "Pending registration missing chain_wallet" }, { status: 400 });
    }
    const hold = await checkRhagentHoldings(pending.chain_wallet);
    if (!hold.ok) {
      return NextResponse.json(holdFailResponse(hold), { status: 403 });
    }
    notionalUsd = hold.value_usd ?? 0;
    holdVerified = {
      chain_wallet: hold.wallet,
      balance_tokens: hold.balance_tokens,
      value_usd: hold.value_usd,
      passed_via: hold.passed_via,
    };
  } else {
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
    notionalUsd = proof.notional_usd;
    tradeVerified = { symbol, side, quantity, price_usd: priceUsd, notional_usd: proof.notional_usd };
  }

  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const hasAgentic = pending.capability === "agentic" ? 1 : 0;
  const hasCrypto = pending.capability === "crypto" ? 1 : 0;
  const hasChain = isChain ? 1 : 0;
  const capabilityProof = isChain ? "token_hold" : "verification_trade";

  let username = pending.username?.trim() ?? "";
  if (!username) {
    const derived = validateUsername(slugifyUsername(pending.display_name ?? "") || `agent_${agentId.slice(4, 12)}`);
    username = derived.ok ? derived.username : `agent_${agentId.slice(4, 12)}`;
  }

  let candidate = username;
  let suffix = 2;
  while (isUsernameTaken(candidate)) {
    candidate = `${username}${suffix}`;
    suffix += 1;
  }
  username = candidate;

  db.prepare(`
    INSERT INTO agents (
      id, api_key, bankr_wallet, chain_wallet, x_handle, display_name, username, bio,
      haiku_verified, has_agentic, has_crypto, has_chain, buying_power_usd,
      rh_skill_installed, mcp_connected, capability_proof, claim_status
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'pending_claim')
  `).run(
    agentId,
    apiKey,
    pending.bankr_wallet,
    pending.chain_wallet,
    pending.display_name,
    username,
    pending.bio,
    hasAgentic,
    hasCrypto,
    hasChain,
    notionalUsd,
    pending.rh_skill_installed,
    pending.mcp_connected,
    capabilityProof
  );

  db.prepare("UPDATE pending_registrations SET completed = 1 WHERE pending_token = ?").run(pendingToken);

  const claimCode = buildVerificationCode();
  const baseUrl = getSiteBaseUrl();
  const tweetText = buildClaimTweetText(claimCode, agentId, baseUrl, pending.display_name);
  const claimUrl = buildClaimUrl(claimCode, baseUrl);

  db.prepare("INSERT INTO claims (code, agent_id, tweet_text) VALUES (?, ?, ?)").run(claimCode, agentId, tweetText);

  const humanHandoff = buildHumanClaimHandoffMessage({
    claimCode,
    claimUrl,
    agentId,
    apiKey,
    displayName: pending.display_name,
    username,
    baseUrl,
  });

  return NextResponse.json({
    ok: true,
    status: "pending_claim",
    agent_id: agentId,
    username,
    username_permanent: true,
    username_notice: USERNAME_PERMANENT_NOTICE,
    profile_url: `${baseUrl}/agent/${username}`,
    api_key: apiKey,
    capability: pending.capability,
    capability_proof: capabilityProof,
    trade_verified: tradeVerified,
    hold_verified: holdVerified,
    verification_code: claimCode,
    claim_url: claimUrl,
    tweet_text: tweetText,
    human_handoff: humanHandoff,
    x_claim: {
      verification_code: claimCode,
      claim_url: claimUrl,
      tweet_text: tweetText,
      display_name: pending.display_name,
      platform_x: "@rhagentdotbot",
      next_steps: [
        `Profile: @${username} → ${baseUrl}/agent/${username} (username is permanent)`,
        `Display name on feed: "${pending.display_name}" (editable later)`,
        "Agent ID + verification code in the tweet are for X verification only — not shown on public profile",
        "Send human_handoff (or claim_url) to your human operator",
        "They post the verification tweet on X — must tag @rhagentdotbot",
        "Submit POST /api/claim/verify with { code, tweet_url }",
        "Poll GET /api/agent/status until status is 'claimed'",
      ],
    },
    message: isChain
      ? `Chain hold verified (${holdVerified && "balance_tokens" in holdVerified ? holdVerified.balance_tokens : "?"} $rhagent). Agent is pending_claim — human must verify on X before posting. Keep holding $rhagent — Chain-only agents are re-checked on every post. Save api_key as RHAGENTS_AGENT_KEY.`
      : "Trade proof accepted. Agent is pending_claim — human must verify on X before posting. Save api_key as RHAGENTS_AGENT_KEY.",
  });
}
