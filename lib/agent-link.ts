import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getDb, type Agent } from "@/lib/db";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey, viewerOwnsAgent } from "@/lib/agent-identity";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api-response";

/**
 * Shared guard for the link-* and connect-* agent routes.
 *
 * Every route in that family repeats the same ~40-line sequence:
 *   parse body → require viewer session → check agent_id → rate-limit →
 *   SELECT agent → 404 if missing → viewerOwnsAgent 403
 *
 * Centralised here so each route shrinks to ~5 lines of scaffolding.
 *
 * Returns either `{ ok: true, agent }` so the caller gets the full typed Agent row,
 * or `{ ok: false, response }` — the caller must immediately `return result.response`.
 */

type LinkGuardOk = { ok: true; agent: Agent };
type LinkGuardFail = { ok: false; response: NextResponse };
export type LinkGuardResult = LinkGuardOk | LinkGuardFail;

export interface LinkGuardOptions {
  /** Rate-limit scope prefix, e.g. "link-bankr". Key becomes `scope:who:agentId`. */
  rateLimitScope: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  /**
   * Allow an Authorization: Bearer RHAGENTS_AGENT_KEY path in addition to viewer session.
   * When true and a valid bearer agent is present, body.agent_id must either be absent or
   * match the bearer agent's own id.
   */
  allowBearerAgent?: boolean;
  /** 401 message shown when neither session nor bearer is present. */
  unauthMessage?: string;
  /** 403 message shown when the viewer doesn't own the requested agent. */
  ownershipMessage?: string;
}

export async function requireOwnedAgentForLink(
  req: NextRequest,
  agentId: string,
  opts: LinkGuardOptions,
): Promise<LinkGuardResult> {
  const {
    rateLimitScope,
    rateLimitMax = 10,
    rateLimitWindowMs = 60 * 60 * 1000,
    allowBearerAgent = false,
    unauthMessage = "Log in to perform this action.",
    ownershipMessage = "Only the verified owner can perform this action.",
  } = opts;

  if (allowBearerAgent) {
    const bearerAgent = getAgentFromRequest(req);
    if (bearerAgent) {
      if (agentId && agentId !== bearerAgent.id) {
        return { ok: false, response: jsonError("agent_id does not match Bearer agent", 403) };
      }
      if (!rateLimit(`${rateLimitScope}:agent:${bearerAgent.id}`, rateLimitMax, rateLimitWindowMs)) {
        return { ok: false, response: rateLimitResponse() };
      }
      return { ok: true, agent: bearerAgent };
    }
  }

  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return { ok: false, response: jsonError(unauthMessage, 401) };
  }
  if (!agentId) {
    return { ok: false, response: jsonError("agent_id required", 400) };
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`${rateLimitScope}:${who}:${agentId}`, rateLimitMax, rateLimitWindowMs)) {
    return { ok: false, response: rateLimitResponse() };
  }

  const agent = getDb()
    .prepare(`SELECT * FROM agents WHERE id = ?`)
    .get(agentId) as Agent | undefined;

  if (!agent) {
    return { ok: false, response: jsonError("Agent not found", 404) };
  }
  if (!viewerOwnsAgent(session, agent)) {
    return { ok: false, response: jsonError(ownershipMessage, 403) };
  }

  return { ok: true, agent };
}
