/** Server-only write side of the MCP connection heartbeat — see ./agent-connection for reads. */
import { getDb } from "./db";

/** Bump on every authenticated call to POST /api/mcp — best-effort, never blocks the request. */
export function touchMcpHeartbeat(agentId: string, client?: string | null): void {
  try {
    const db = getDb();
    db.prepare(`UPDATE agents SET mcp_last_used_at = datetime('now'), mcp_last_client = ? WHERE id = ?`).run(
      client ?? null,
      agentId,
    );
  } catch {
    /* best-effort telemetry — never fail the MCP call over this */
  }
}
