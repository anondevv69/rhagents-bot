/**
 * Wallet-first viewer login: personal_sign + $rhagent hold → session + Chain agent profile.
 */

import { generateAgentId, generateApiKey } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { verifyChainWalletOwnership } from "@/lib/chain-proof";
import { checkRhagentHoldings, holdFailResponse, type HoldCheckOk } from "@/lib/rhagent-holdings";
import { isUsernameTaken, validateUsername } from "@/lib/username";

function shortWalletLabel(wallet: `0x${string}`): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function allocateUsername(wallet: `0x${string}`, preferred?: string | null): string {
  if (preferred) {
    const v = validateUsername(preferred);
    if (v.ok && !isUsernameTaken(v.username)) return v.username;
  }
  const base = `w_${wallet.slice(2, 10).toLowerCase()}`;
  let candidate = base;
  let n = 2;
  while (isUsernameTaken(candidate)) {
    candidate = `${base}${n}`;
    n += 1;
  }
  return candidate;
}

function findAgentByChainWallet(wallet: `0x${string}`): Agent | null {
  return (
    (getDb()
      .prepare(`SELECT * FROM agents WHERE LOWER(chain_wallet) = ?`)
      .get(wallet.toLowerCase()) as Agent | undefined) ?? null
  );
}

function createChainAgentFromWallet(
  wallet: `0x${string}`,
  hold: HoldCheckOk,
  opts?: { username?: string | null; display_name?: string | null },
): { agent: Agent; api_key: string; created: true } | { error: string } {
  if (opts?.username) {
    const v = validateUsername(opts.username);
    if (!v.ok) return { error: v.error };
    if (isUsernameTaken(v.username)) {
      return { error: `Username @${v.username} is taken — pick another` };
    }
  }

  const db = getDb();
  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const username = allocateUsername(wallet, opts?.username);
  const displayName =
    (opts?.display_name?.trim() && opts.display_name.trim().slice(0, 40)) ||
    shortWalletLabel(wallet);

  db.prepare(
    `INSERT INTO agents (
      id, api_key, bankr_wallet, chain_wallet, x_handle, display_name, username, bio,
      haiku_verified, has_agentic, has_crypto, has_chain, buying_power_usd,
      rh_skill_installed, mcp_connected, capability_proof, claim_status, owner_display_name
    ) VALUES (?, ?, NULL, ?, NULL, ?, ?, NULL, 1, 0, 0, 1, ?, 0, 0, 'token_hold', 'claimed', ?)`,
  ).run(
    agentId,
    apiKey,
    wallet.toLowerCase(),
    displayName,
    username,
    hold.value_usd ?? 0,
    displayName,
  );

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
  void import("@/lib/inscriber").then(({ scheduleInscribeAgent }) => {
    scheduleInscribeAgent(agent);
  });
  return { agent, api_key: apiKey, created: true };
}

function ensureWalletClaimed(agent: Agent, wallet: `0x${string}`): Agent {
  const db = getDb();
  if (agent.claim_status !== "claimed" || !agent.has_chain) {
    db.prepare(
      `UPDATE agents
       SET claim_status = 'claimed',
           has_chain = 1,
           chain_wallet = ?,
           capability_proof = COALESCE(capability_proof, 'token_hold'),
           haiku_verified = 1,
           owner_display_name = COALESCE(owner_display_name, ?)
       WHERE id = ?`,
    ).run(wallet.toLowerCase(), shortWalletLabel(wallet), agent.id);
  }
  const refreshed = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agent.id) as Agent;
  if (!refreshed.nft_tx_hash) {
    void import("@/lib/inscriber").then(({ scheduleInscribeAgent }) => {
      scheduleInscribeAgent(refreshed);
    });
  }
  return refreshed;
}

export type WalletLoginOk = {
  ok: true;
  created: boolean;
  session_only: false;
  chain_wallet: `0x${string}`;
  agent_id: string;
  username: string | null;
  display_name: string | null;
  /** Only returned when a new agent was created — show once. */
  api_key?: string;
  /** null when logging into an existing agent without a current $rhagent hold. */
  hold: {
    balance_tokens: number;
    value_usd: number | null;
    passed_via: HoldCheckOk["passed_via"];
  } | null;
};

/**
 * Signature was valid but there's no agent for this wallet and no $rhagent hold —
 * we still log the human in (viewer session) so they can pick a path (BYO agent,
 * Bankr, or buy the token). No agent is created and no claim status is upgraded.
 */
export type WalletSessionOnly = {
  ok: true;
  created: false;
  session_only: true;
  chain_wallet: `0x${string}`;
  hold_fail: ReturnType<typeof holdFailResponse>;
};

export type WalletLoginFail = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Prove wallet ownership (single-use nonce + personal_sign), then log the human in.
 *
 * Trust model:
 * - A valid signature is always enough for a viewer *session* (human entry).
 * - The $rhagent hold gates trust *upgrades* only: creating a new claimed Chain agent,
 *   or upgrading an existing agent to claimed/has_chain (`ensureWalletClaimed`).
 * - Without a hold and without an existing agent, the caller gets `session_only` — the
 *   human is logged in and picks a path (BYO agent / Bankr / buy the token).
 */
export async function loginOrRegisterWithChainWallet(opts: {
  chain_wallet: string;
  nonce: string;
  signature: string;
  /** Desired @handle — only used when creating a new agent. Permanent after create. */
  username?: string | null;
  /** Display name — only used when creating a new agent. */
  display_name?: string | null;
}): Promise<WalletLoginOk | WalletSessionOnly | WalletLoginFail> {
  const ownership = await verifyChainWalletOwnership({
    chain_wallet: opts.chain_wallet,
    nonce: opts.nonce,
    signature: opts.signature,
  });
  if (!ownership.ok) {
    return { ok: false, status: 400, body: { ok: false, error: ownership.error } };
  }

  const hold = await checkRhagentHoldings(ownership.wallet);
  const wallet = ownership.wallet;

  const existing = findAgentByChainWallet(wallet);
  if (existing) {
    // Returning owner: session on signature alone; claim/has_chain upgrade stays hold-gated.
    const agent = hold.ok ? ensureWalletClaimed(existing, wallet) : existing;
    return {
      ok: true,
      created: false,
      session_only: false,
      chain_wallet: wallet,
      agent_id: agent.id,
      username: agent.username,
      display_name: agent.display_name ?? agent.owner_display_name,
      hold: hold.ok
        ? {
            balance_tokens: hold.balance_tokens,
            value_usd: hold.value_usd,
            passed_via: hold.passed_via,
          }
        : null,
    };
  }

  if (!hold.ok) {
    return {
      ok: true,
      created: false,
      session_only: true,
      chain_wallet: wallet,
      hold_fail: holdFailResponse(hold),
    };
  }

  const created = createChainAgentFromWallet(wallet, hold, {
    username: opts.username,
    display_name: opts.display_name,
  });
  if ("error" in created) {
    return { ok: false, status: 400, body: { ok: false, error: created.error } };
  }

  return {
    ok: true,
    created: true,
    session_only: false,
    chain_wallet: wallet,
    agent_id: created.agent.id,
    username: created.agent.username,
    display_name: created.agent.display_name,
    api_key: created.api_key,
    hold: {
      balance_tokens: hold.balance_tokens,
      value_usd: hold.value_usd,
      passed_via: hold.passed_via,
    },
  };
}

/** Session already proved wallet ownership — create Chain profile when $rhagent hold passes. */
export async function activateChainProfileForWallet(walletRaw: string): Promise<
  | {
      ok: true;
      created: boolean;
      agent_id: string;
      username: string | null;
      display_name: string | null;
      api_key?: string;
      profile_url: string;
    }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const hold = await checkRhagentHoldings(walletRaw);
  if (!hold.ok) {
    return { ok: false, status: 403, body: holdFailResponse(hold) };
  }

  const wallet = hold.wallet;
  const existing = findAgentByChainWallet(wallet);
  if (existing) {
    return {
      ok: true,
      created: false,
      agent_id: existing.id,
      username: existing.username,
      display_name: existing.display_name ?? existing.owner_display_name,
      profile_url: existing.username ? `/agent/${existing.username}` : "/account",
    };
  }

  const created = createChainAgentFromWallet(wallet, hold);
  if ("error" in created) {
    return { ok: false, status: 400, body: { ok: false, error: created.error } };
  }

  return {
    ok: true,
    created: true,
    agent_id: created.agent.id,
    username: created.agent.username,
    display_name: created.agent.display_name,
    api_key: created.api_key,
    profile_url: created.agent.username ? `/agent/${created.agent.username}` : "/account",
  };
}
