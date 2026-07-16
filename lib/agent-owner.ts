/** Owner-facing helpers — connections summary + API key rotation (viewer session). */

import { generateApiKey } from "./auth";
import { getDb, type Agent } from "./db";
import { viewerOwnsAgent } from "./agent-identity";
import type { ViewerSession } from "./viewer";

export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 20) return "rhagents_••••••••";
  return `${apiKey.slice(0, 16)}…${apiKey.slice(-4)}`;
}

export interface OwnerConnections {
  claim_status: string;
  x: { connected: boolean; handle: string | null };
  telegram: { connected: boolean; username: string | null };
  discord: { connected: boolean; username: string | null };
  capabilities: {
    agentic: boolean;
    crypto: boolean;
    chain: boolean;
    mcp_connected: boolean;
    rh_skill_installed: boolean;
  };
  bankr_wallet: string | null;
  chain_wallet: string | null;
  nft: { minted: boolean; explorer_url: string | null };
}

export function ownerConnectionsFromAgent(agent: Agent): OwnerConnections {
  return {
    claim_status: agent.claim_status,
    x: {
      connected: Boolean(agent.owner_x_handle),
      handle: agent.owner_x_handle,
    },
    telegram: {
      connected: Boolean(agent.owner_telegram_id),
      username: agent.owner_telegram_username,
    },
    discord: {
      connected: Boolean(agent.owner_discord_id),
      username: agent.owner_discord_username,
    },
    capabilities: {
      agentic: !!agent.has_agentic,
      crypto: !!agent.has_crypto,
      chain: !!agent.has_chain,
      mcp_connected: !!agent.mcp_connected,
      rh_skill_installed: !!agent.rh_skill_installed,
    },
    bankr_wallet: agent.bankr_wallet,
    chain_wallet: agent.chain_wallet,
    nft: {
      minted: Boolean(agent.nft_tx_hash),
      explorer_url: agent.nft_explorer_url,
    },
  };
}

/** Agents this viewer session owns (claimed). */
export function listAgentsOwnedBySession(session: ViewerSession | null): Agent[] {
  if (!session) return [];
  const db = getDb();
  const out: Agent[] = [];
  const seen = new Set<string>();

  if (session.x_handle) {
    const normalized = session.x_handle.replace(/^@/, "").toLowerCase();
    const rows = db
      .prepare(
        `SELECT * FROM agents
         WHERE LOWER(REPLACE(COALESCE(owner_x_handle, ''), '@', '')) = ?
           AND (claim_status = 'claimed' OR x_verified = 1)`,
      )
      .all(normalized) as Agent[];
    for (const a of rows) {
      if (!seen.has(a.id) && viewerOwnsAgent(session, a)) {
        seen.add(a.id);
        out.push(a);
      }
    }
  }
  if (session.telegram_id) {
    const a = db
      .prepare(`SELECT * FROM agents WHERE owner_telegram_id = ?`)
      .get(session.telegram_id) as Agent | undefined;
    if (a && !seen.has(a.id) && viewerOwnsAgent(session, a)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  if (session.discord_id) {
    const a = db
      .prepare(`SELECT * FROM agents WHERE owner_discord_id = ?`)
      .get(session.discord_id) as Agent | undefined;
    if (a && !seen.has(a.id) && viewerOwnsAgent(session, a)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  if (session.chain_wallet) {
    const a = db
      .prepare(`SELECT * FROM agents WHERE LOWER(chain_wallet) = ?`)
      .get(session.chain_wallet.toLowerCase()) as Agent | undefined;
    if (a && !seen.has(a.id) && viewerOwnsAgent(session, a)) {
      seen.add(a.id);
      out.push(a);
    }
  }

  return out;
}

export function rotateAgentApiKey(agentId: string): string {
  const db = getDb();
  const newKey = generateApiKey(agentId);
  const result = db.prepare(`UPDATE agents SET api_key = ? WHERE id = ?`).run(newKey, agentId);
  if (result.changes !== 1) {
    throw new Error("rotate_failed");
  }
  return newKey;
}
