import { getDb } from "./db";
import { getSiteBaseUrl } from "./rhagent-setup";
import { ownerSessionHandle } from "./agent-identity";

export function findClaimedAgentByHandle(handle: string): { x_handle: string; id: string; username: string | null } | null {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  const db = getDb();
  const agent = db.prepare(`
    SELECT id, owner_x_handle, x_handle, username FROM agents
    WHERE (
      LOWER(REPLACE(COALESCE(owner_x_handle, ''), '@', '')) = ?
      OR LOWER(REPLACE(COALESCE(x_handle, ''), '@', '')) = ?
    )
      AND (claim_status = 'claimed' OR x_verified = 1)
    LIMIT 1
  `).get(normalized, normalized) as {
    id: string;
    owner_x_handle: string | null;
    x_handle: string | null;
    username: string | null;
  } | null;

  if (!agent) return null;
  const sessionHandle = ownerSessionHandle(agent);
  if (!sessionHandle) return null;
  return { id: agent.id, x_handle: sessionHandle, username: agent.username ?? null };
}

export function findVerifiedClaim(code: string): { x_handle: string; agent_id: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT c.verified, a.id AS agent_id, a.owner_x_handle, a.x_handle, a.claim_status, a.x_verified
    FROM claims c
    JOIN agents a ON a.id = c.agent_id
    WHERE c.code = ?
  `).get(code.toUpperCase()) as {
    verified: number;
    agent_id: string;
    owner_x_handle: string | null;
    x_handle: string | null;
    claim_status: string;
    x_verified: number;
  } | null;

  if (!row) return null;
  const claimed = row.verified || row.claim_status === "claimed" || row.x_verified;
  const handle = ownerSessionHandle(row);
  if (!claimed || !handle) return null;
  return { x_handle: handle, agent_id: row.agent_id };
}

export function findClaimByAgentId(agentId: string): { code: string; claim_url: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT code FROM claims WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(agentId) as { code: string } | null;
  if (!row) return null;
  const base = getSiteBaseUrl();
  return { code: row.code, claim_url: `${base}/claim/${row.code}` };
}
