import { resolveWalletMe } from "./bankr";
import { getDb, type Agent } from "./db";
import { scheduleInscribeAgent } from "./inscriber";
import { linkBankrChainWallet } from "./link-chain-wallet";
import { buildWalletSnapshot, type WalletSnapshot } from "./wallet-snapshot";

export type LinkBankrResult =
  | { ok: true; bankr_wallet: string; agent: Agent; wallet_snapshot: WalletSnapshot | null }
  | { ok: false; status: number; body: Record<string, unknown> };

export interface LinkBankrOptions {
  agenticToken?: string | null;
  rhApiKey?: string | null;
  rhPrivateKeyB64?: string | null;
}

/**
 * Attach a Bankr EVM wallet to an agent by proving ownership with a Bankr API key.
 * The key is never stored — only the resolved address is written.
 */
export async function linkBankrWallet(
  agentId: string,
  bankrApiKey: string,
  opts: LinkBankrOptions = {},
): Promise<LinkBankrResult> {
  const key = bankrApiKey.trim();
  if (!key) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "bankr_api_key required" },
    };
  }

  const resolved = await resolveWalletMe(key);
  if (!resolved || !/^0x[a-fA-F0-9]{40}$/.test(resolved)) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "Invalid bankr_api_key" },
    };
  }

  const wallet = resolved.toLowerCase();
  const db = getDb();
  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent | undefined;
  if (!agent) {
    return { ok: false, status: 404, body: { ok: false, error: "Agent not found" } };
  }

  if (agent.bankr_wallet?.toLowerCase() === wallet) {
    const snapshot = await buildWalletSnapshot({
      bankrApiKey: key,
      agent,
      agenticToken: opts.agenticToken,
      rhApiKey: opts.rhApiKey,
      rhPrivateKeyB64: opts.rhPrivateKeyB64,
    });
    db.prepare(
      `UPDATE agents SET bankr_wallet_snapshot = ?, bankr_wallet_snapshot_at = datetime('now') WHERE id = ?`,
    ).run(JSON.stringify(snapshot), agentId);
    let refreshed = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
    if (!refreshed.has_chain) {
      const chain = await linkBankrChainWallet(agentId, wallet as `0x${string}`);
      if (chain.ok) {
        refreshed = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
      }
    }
    return { ok: true, bankr_wallet: wallet, agent: refreshed, wallet_snapshot: snapshot };
  }

  const taken = db
    .prepare(`SELECT id, username FROM agents WHERE LOWER(bankr_wallet) = ? AND id != ?`)
    .get(wallet, agentId) as { id: string; username: string | null } | undefined;
  if (taken) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        error: "wallet_taken",
        message: "That Bankr wallet is already linked to another agent.",
        agent_id: taken.id,
        username: taken.username,
      },
    };
  }

  db.prepare(`UPDATE agents SET bankr_wallet = ? WHERE id = ?`).run(wallet, agentId);
  const updated = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;

  const snapshot = await buildWalletSnapshot({
    bankrApiKey: key,
    agent: updated,
    agenticToken: opts.agenticToken,
    rhApiKey: opts.rhApiKey,
    rhPrivateKeyB64: opts.rhPrivateKeyB64,
  });
  db.prepare(
    `UPDATE agents SET bankr_wallet_snapshot = ?, bankr_wallet_snapshot_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(snapshot), agentId);

  const after = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;

  // Bankr EVM wallet on Robinhood Chain — auto-enable chain capability when $RHAGENT hold passes.
  if (!after.has_chain) {
    const chain = await linkBankrChainWallet(agentId, wallet as `0x${string}`);
    if (chain.ok) {
      const linked = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Agent;
      scheduleInscribeAgent(linked);
      return {
        ok: true,
        bankr_wallet: wallet,
        agent: linked,
        wallet_snapshot: snapshot,
      };
    }
  }

  // If identity NFT is still pending, mint (prefers verified chain_wallet when present).
  scheduleInscribeAgent(after);

  return { ok: true, bankr_wallet: wallet, agent: after, wallet_snapshot: snapshot };
}
