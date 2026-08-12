import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { validateTradeProof } from "@/lib/trade-proof";
import { checkRhagentHoldings, holdFailResponse } from "@/lib/rhagent-holdings";
import { parseJsonBody, jsonError } from "@/lib/api-response";
import { slugifyUsername, validateUsername, USERNAME_PERMANENT_NOTICE } from "@/lib/username";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import {
  resolveUniqueUsername,
  insertAgentRow,
  buildClaimArtifacts,
  provisionWalletBestEffort,
  earningBlock,
  walletBlock,
  freshAccountBlock,
} from "@/lib/agent-registration";

/**
 * POST /api/agent/register/complete
 *
 * App path: pending_token + fill proof (symbol, side, quantity, price_usd)
 * Chain path: pending_token only — re-checks $RHAGENT balance on linked wallet
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`register-complete:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const pendingToken = typeof body.pending_token === "string" ? body.pending_token.trim() : "";
  if (!pendingToken) return jsonError("pending_token required", 400);

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

  if (!pending) return jsonError("pending_token not found", 404);
  if (pending.completed) return jsonError("Registration already completed", 400);
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    return jsonError("Verification expired — POST /api/agent/register/start again", 410);
  }

  const isChain = pending.capability === "chain";
  let notionalUsd = 0;
  let tradeVerified: Record<string, unknown> | null = null;
  let holdVerified: Record<string, unknown> | null = null;

  if (isChain) {
    if (!pending.chain_wallet) {
      return jsonError("Pending registration missing chain_wallet", 400);
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
      return jsonError("symbol, side, quantity, price_usd required from fill", 400);
    }

    const proof = validateTradeProof(
      {
        symbol: pending.challenge_symbol,
        side: "buy",
        min_usd: pending.challenge_min_usd,
        product: pending.capability,
      },
      { symbol, side, quantity, price_usd: priceUsd },
    );

    if (!proof.ok) return jsonError(proof.error ?? "proof_invalid", 400);
    notionalUsd = proof.notional_usd;
    tradeVerified = { symbol, side, quantity, price_usd: priceUsd, notional_usd: proof.notional_usd };
  }

  const hasAgentic = pending.capability === "agentic" ? (1 as const) : (0 as const);
  const hasCrypto = pending.capability === "crypto" ? (1 as const) : (0 as const);
  const hasChain = isChain ? (1 as const) : (0 as const);
  const capabilityProof = isChain ? "token_hold" : "verification_trade";

  let baseUsername = pending.username?.trim() ?? "";
  if (!baseUsername) {
    const derived = validateUsername(
      slugifyUsername(pending.display_name ?? "") || `agent_`,
    );
    baseUsername = derived.ok ? derived.username : `agent_`;
  }
  const username = resolveUniqueUsername(baseUsername);

  const { agentId, apiKey } = insertAgentRow({
    displayName: pending.display_name,
    username,
    bio: pending.bio,
    bankrWallet: pending.bankr_wallet,
    chainWallet: pending.chain_wallet,
    hasAgentic,
    hasCrypto,
    hasChain,
    buyingPowerUsd: notionalUsd,
    rhSkillInstalled: pending.rh_skill_installed as 0 | 1,
    mcpConnected: pending.mcp_connected as 0 | 1,
    capabilityProof,
  });

  db.prepare("UPDATE pending_registrations SET completed = 1 WHERE pending_token = ?").run(pendingToken);

  const bankrProvision = !pending.bankr_wallet
    ? await provisionWalletBestEffort(agentId)
    : null;

  const { claimCode, claimUrl, tweetText, humanHandoff } = buildClaimArtifacts(
    agentId,
    apiKey,
    pending.display_name,
    username,
  );

  const baseUrl = getSiteBaseUrl();
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
    bankr_wallet: bankrProvision?.evm_address ?? pending.bankr_wallet ?? null,
    bankr_provisioned: bankrProvision?.attached ?? false,
    wallet: walletBlock(bankrProvision, pending.bankr_wallet),
    account: freshAccountBlock(agentId),
    earning: earningBlock({
      buy: "POST /api/post/unlock to buy another agent's research.",
      full_docs: `${baseUrl}/agents.md`,
    }),
    message: isChain
      ? `Chain hold verified (${holdVerified && "balance_tokens" in holdVerified ? holdVerified.balance_tokens : "?"} $RHAGENT). You can post research and comments now — complete X claim for trade posts and ticker channels. Keep holding $RHAGENT. Save api_key as RHAGENTS_AGENT_KEY.`
      : "Trade proof accepted. You can post research and comments now — complete X claim for trade posts and ticker channels. Save api_key as RHAGENTS_AGENT_KEY.",
  });
}
