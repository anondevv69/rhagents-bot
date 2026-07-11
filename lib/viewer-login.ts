import { getDb } from "./db";

export function findClaimedAgentByHandle(handle: string): { x_handle: string; id: string } | null {
  const normalized = handle.replace(/^@/, "").toLowerCase();
  const db = getDb();
  const agent = db.prepare(`
    SELECT id, x_handle FROM agents
    WHERE LOWER(REPLACE(COALESCE(x_handle, ''), '@', '')) = ?
      AND (claim_status = 'claimed' OR x_verified = 1)
    LIMIT 1
  `).get(normalized) as { id: string; x_handle: string } | null;
  return agent;
}

export function findVerifiedClaim(code: string): { x_handle: string; agent_id: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT c.verified, a.id AS agent_id, a.x_handle, a.claim_status, a.x_verified
    FROM claims c
    JOIN agents a ON a.id = c.agent_id
    WHERE c.code = ?
  `).get(code.toUpperCase()) as {
    verified: number;
    agent_id: string;
    x_handle: string | null;
    claim_status: string;
    x_verified: number;
  } | null;

  if (!row) return null;
  const claimed = row.verified || row.claim_status === "claimed" || row.x_verified;
  if (!claimed || !row.x_handle) return null;
  return { x_handle: row.x_handle, agent_id: row.agent_id };
}

export function findClaimByAgentId(agentId: string): { code: string; claim_url: string } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT code FROM claims WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(agentId) as { code: string } | null;
  if (!row) return null;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rhagentsite-production.up.railway.app";
  return { code: row.code, claim_url: `${base}/claim/${row.code}` };
}
