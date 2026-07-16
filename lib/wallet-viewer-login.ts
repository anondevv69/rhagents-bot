/**
 * Wallet-first viewer login: personal_sign + $rhagent hold → session + Chain agent profile.
 */

import { generateAgentId, generateApiKey } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { verifyChainWalletOwnership } from "@/lib/chain-proof";
import { checkRhagentHoldings, holdFailResponse, type HoldCheckOk } from "@/lib/rhagent-holdings";
import { isUsernameTaken } from "@/lib/username";

function shortWalletLabel(wallet: `0x${string}`): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function allocateUsername(wallet: `0x${string}`): string {
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

function createChainAgentFromWallet(wallet: `0x${string}`, hold: HoldCheckOk): { agent: Agent; api_key: string; created: true } {
  const db = getDb();
  const agentId = generateAgentId();
  const apiKey = generateApiKey(agentId);
  const username = allocateUsername(wallet);
  const displayName = shortWalletLabel(wallet);

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
  return db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agent.id) as Agent;
}

export type WalletLoginOk = {
  ok: true;
  created: boolean;
  chain_wallet: `0x${string}`;
  agent_id: string;
  username: string | null;
  display_name: string | null;
  /** Only returned when a new agent was created — show once. */
  api_key?: string;
  hold: {
    balance_tokens: number;
    value_usd: number | null;
    passed_via: HoldCheckOk["passed_via"];
  };
};

export type WalletLoginFail = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Prove wallet ownership, require $rhagent hold, find-or-create a claimed Chain agent.
 */
export async function loginOrRegisterWithChainWallet(opts: {
  chain_wallet: string;
  nonce: string;
  signature: string;
}): Promise<WalletLoginOk | WalletLoginFail> {
  const ownership = await verifyChainWalletOwnership({
    chain_wallet: opts.chain_wallet,
    nonce: opts.nonce,
    signature: opts.signature,
  });
  if (!ownership.ok) {
    return { ok: false, status: 400, body: { ok: false, error: ownership.error } };
  }

  const hold = await checkRhagentHoldings(ownership.wallet);
  if (!hold.ok) {
    return { ok: false, status: 403, body: holdFailResponse(hold) };
  }

  const existing = findAgentByChainWallet(hold.wallet);
  if (existing) {
    const agent = ensureWalletClaimed(existing, hold.wallet);
    return {
      ok: true,
      created: false,
      chain_wallet: hold.wallet,
      agent_id: agent.id,
      username: agent.username,
      display_name: agent.display_name ?? agent.owner_display_name,
      hold: {
        balance_tokens: hold.balance_tokens,
        value_usd: hold.value_usd,
        passed_via: hold.passed_via,
      },
    };
  }

  const { agent, api_key } = createChainAgentFromWallet(hold.wallet, hold);
  return {
    ok: true,
    created: true,
    chain_wallet: hold.wallet,
    agent_id: agent.id,
    username: agent.username,
    display_name: agent.display_name,
    api_key,
    hold: {
      balance_tokens: hold.balance_tokens,
      value_usd: hold.value_usd,
      passed_via: hold.passed_via,
    },
  };
}
