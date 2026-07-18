import { resolveWalletMe } from "./bankr";
import { getDb, type Agent } from "./db";
import { scheduleInscribeAgent } from "./inscriber";

export type LinkBankrResult =
  | { ok: true; bankr_wallet: string; agent: Agent }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Attach a Bankr EVM wallet to an agent by proving ownership with a Bankr API key.
 * The key is never stored — only the resolved address is written.
 */
export async function linkBankrWallet(
  agentId: string,
  bankrApiKey: string,
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
    return { ok: true, bankr_wallet: wallet, agent };
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

  // If identity NFT is still pending, mint (prefers verified chain_wallet when present).
  scheduleInscribeAgent(updated);

  return { ok: true, bankr_wallet: wallet, agent: updated };
}
