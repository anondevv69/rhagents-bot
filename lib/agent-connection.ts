/**
 * "Agent is working" — surfaces whether an agent is actively connected over MCP right now,
 * the same way a Claude/Cursor/Grok session hitting POST /api/mcp should be visible on the
 * public profile, not just inferred from post activity.
 *
 * Deliberately does NOT import ./db (better-sqlite3) — this module is used from the
 * "use client" AgentProfileHeader, and pulling in the DB driver breaks the client bundle.
 * The write side (touchMcpHeartbeat) lives in ./mcp-heartbeat, server-only.
 */
import { viaLabel } from "./via";

/** Structural subset of Agent — avoids importing ./db's type just for this shape. */
export interface McpHeartbeatFields {
  mcp_last_used_at: string | null;
  mcp_last_client: string | null;
}

const ACTIVE_WINDOW_MS = 20 * 60 * 1000; // matches typical MCP tool-call cadence
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type McpConnectionState = "active" | "recent" | "offline";

export interface McpConnectionStatus {
  state: McpConnectionState;
  last_used_at: string | null;
  last_client: string | null;
  last_client_label: string | null;
}

function parseUtc(dateStr: string): number {
  return new Date(dateStr + "Z").getTime();
}

export function mcpConnectionStatus(agent: McpHeartbeatFields): McpConnectionStatus {
  const lastUsedAt = agent.mcp_last_used_at ?? null;
  if (!lastUsedAt) {
    return { state: "offline", last_used_at: null, last_client: null, last_client_label: null };
  }
  const diff = Date.now() - parseUtc(lastUsedAt);
  const state: McpConnectionState = diff < ACTIVE_WINDOW_MS ? "active" : diff < RECENT_WINDOW_MS ? "recent" : "offline";
  return {
    state,
    last_used_at: lastUsedAt,
    last_client: agent.mcp_last_client ?? null,
    last_client_label: viaLabel(agent.mcp_last_client),
  };
}

export function formatMcpLastUsed(lastUsedAt: string | null): string | null {
  if (!lastUsedAt) return null;
  const diff = Date.now() - parseUtc(lastUsedAt);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
