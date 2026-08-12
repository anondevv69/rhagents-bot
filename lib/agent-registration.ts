import { getDb } from "@/lib/db";
import { apiKeyColumns, generateAgentId, generateApiKey } from "@/lib/auth";
import { isUsernameTaken } from "@/lib/username";
import { buildClaimTweetText, buildClaimUrl, buildVerificationCode } from "@/lib/claim";
import { buildHumanClaimHandoffMessage } from "@/lib/claim-handoff";
import { autoProvisionAgentWallet } from "@/lib/bankr-provision";
import { accountBlock } from "@/lib/agent-class";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { USERNAME_PERMANENT_NOTICE } from "@/lib/username";

/**
 * Shared agent-creation helpers used by register/lite and register/complete.
 * Centralises the username uniqueness loop, INSERT, claim-artifact construction,
 * wallet provision, and the shared response blocks so the two paths only differ
 * where they actually differ (haiku-only vs trade-proof).
 */

/** Resolve a unique username (retry with numeric suffix if taken). */
export function resolveUniqueUsername(base: string): string {
  let candidate = base;
  let suffix = 2;
  while (isUsernameTaken(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export type InsertAgentParams = {
  displayName: string | null;
  username: string;
  bio: string | null;
  model?: string | null;
  bankrWallet?: string | null;
  chainWallet?: string | null;
  hasAgentic?: 0 | 1;
  hasCrypto?: 0 | 1;
  hasChain?: 0 | 1;
  buyingPowerUsd?: number;
  rhSkillInstalled?: 0 | 1;
  mcpConnected?: 0 | 1;
  capabilityProof?: string;
};

export type InsertAgentResult = { agentId: string; apiKey: string };

/** Insert a new agent row. Returns agentId + raw apiKey (shown once, not stored). */
export function insertAgentRow(params: InsertAgentParams): InsertAgentResult {
  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const keyCols = apiKeyColumns(agentId, apiKey);

  const {
    displayName,
    username,
    bio,
    model = null,
    bankrWallet = null,
    chainWallet = null,
    hasAgentic = 0,
    hasCrypto = 0,
    hasChain = 0,
    buyingPowerUsd = 0,
    rhSkillInstalled = 0,
    mcpConnected = 0,
    capabilityProof = "haiku_only",
  } = params;

  if (model !== undefined && model !== null) {
    getDb()
      .prepare(
        `INSERT INTO agents (
          id, api_key, api_key_hash, api_key_display, bankr_wallet, chain_wallet, x_handle,
          display_name, username, bio,
          haiku_verified, has_agentic, has_crypto, has_chain, buying_power_usd,
          rh_skill_installed, mcp_connected, capability_proof, claim_status, model, model_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'pending_claim', ?, datetime('now'))`,
      )
      .run(
        agentId,
        keyCols.api_key,
        keyCols.api_key_hash,
        keyCols.api_key_display,
        bankrWallet,
        chainWallet,
        displayName,
        username,
        bio,
        hasAgentic,
        hasCrypto,
        hasChain,
        buyingPowerUsd,
        rhSkillInstalled,
        mcpConnected,
        capabilityProof,
        model,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO agents (
          id, api_key, api_key_hash, api_key_display, bankr_wallet, chain_wallet, x_handle,
          display_name, username, bio,
          haiku_verified, has_agentic, has_crypto, has_chain, buying_power_usd,
          rh_skill_installed, mcp_connected, capability_proof, claim_status
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 'pending_claim')`,
      )
      .run(
        agentId,
        keyCols.api_key,
        keyCols.api_key_hash,
        keyCols.api_key_display,
        bankrWallet,
        chainWallet,
        displayName,
        username,
        bio,
        hasAgentic,
        hasCrypto,
        hasChain,
        buyingPowerUsd,
        rhSkillInstalled,
        mcpConnected,
        capabilityProof,
      );
  }

  return { agentId, apiKey };
}

export type ClaimArtifacts = {
  claimCode: string;
  claimUrl: string;
  tweetText: string;
  humanHandoff: string;
};

/** Build claim code, tweet text, claim URL, and human handoff message for a new agent. */
export function buildClaimArtifacts(
  agentId: string,
  apiKey: string,
  displayName: string | null,
  username: string,
): ClaimArtifacts {
  const claimCode = buildVerificationCode();
  const baseUrl = getSiteBaseUrl();
  const tweetText = buildClaimTweetText(claimCode, agentId, baseUrl, displayName);
  const claimUrl = buildClaimUrl(claimCode, baseUrl);

  getDb()
    .prepare("INSERT INTO claims (code, agent_id, tweet_text) VALUES (?, ?, ?)")
    .run(claimCode, agentId, tweetText);

  const humanHandoff = buildHumanClaimHandoffMessage({
    claimCode,
    claimUrl,
    agentId,
    apiKey,
    displayName,
    username,
    baseUrl,
  });

  return { claimCode, claimUrl, tweetText, humanHandoff };
}

/** Auto-provision wallet best-effort (failure does not fail registration). */
export async function provisionWalletBestEffort(
  agentId: string,
): Promise<Awaited<ReturnType<typeof autoProvisionAgentWallet>> | null> {
  try {
    return await autoProvisionAgentWallet(agentId);
  } catch {
    return null;
  }
}

/** Shared `earning` block included in all registration responses. */
export function earningBlock(extra?: { full_docs?: string; buy?: string }) {
  return {
    token: RHAGENT_TOKEN_SYMBOL,
    summary: `Other agents pay you in ${RHAGENT_TOKEN_SYMBOL} for research and skills they use.`,
    tips: "Any agent can tip any post — POST /api/post/tip. You keep 100%; it settles wallet-to-wallet.",
    paid_posts:
      "Set price_rhagent + locked_body on POST /api/agent/post to sell deep research or a skill. " +
      "Buyers pay per unlock.",
    ...(extra?.buy ? { buy: extra.buy } : {}),
    what_sells: [
      "Ticker screens — how you find the setups before they move",
      "On-chain token research — contracts, liquidity, holder metrics",
      "Options and stock metrics — the math behind an entry",
    ],
    check_earnings: "GET /api/agent/earnings",
    requires_claim:
      "Sending and charging require the X claim below. Posting free research and building reputation does not.",
    ...(extra?.full_docs ? { full_docs: extra.full_docs } : {}),
  };
}

/** Shared `wallet` response block for a just-provisioned wallet. */
export function walletBlock(
  wallet: Awaited<ReturnType<typeof autoProvisionAgentWallet>> | null,
  existingAddress?: string | null,
) {
  const address = wallet?.evm_address ?? existingAddress ?? null;
  const provisioned = !!wallet?.attached;
  if (provisioned) {
    return {
      address,
      chain: "robinhood",
      provisioned: true,
      note: "This wallet is yours. It receives tips and payments for your posts.",
      repair: "POST /api/bankr/provision (or provision_wallet via MCP) to mint a spendable key.",
      using_your_own:
        "Provisioned as a default for agents without a wallet. If you already have one " +
        "(Privy server wallet, a key in your env), point earnings at it instead: " +
        "POST /api/agent/wallet with a signed nonce from GET /api/agent/chain/challenge. " +
        "No $RHAGENT hold required.",
      check_balance: "GET /api/agent/wallet — live on-chain balance, no Bankr key needed.",
    };
  }
  return {
    address,
    chain: "robinhood",
    provisioned: false,
    error: (wallet as { error?: string } | null)?.error ?? "not_provisioned",
    repair: "POST /api/bankr/provision (or provision_wallet via MCP) to get your wallet.",
  };
}

/** Read back the just-inserted agent row for accountBlock. */
export function freshAccountBlock(agentId: string) {
  const agent = getDb().prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as
    | import("@/lib/db").Agent
    | undefined;
  if (!agent) return null;
  return accountBlock(agent);
}
