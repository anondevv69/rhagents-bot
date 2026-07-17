/**
 * Resolve the claimed agent owned by a viewer session (for web compose / channels).
 */

import type { Agent } from "@/lib/db";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";
import type { ViewerSession } from "@/lib/viewer";
import { isChainOnlyAgent } from "@/lib/auth";

export function resolveOwnedAgentForViewer(session: ViewerSession | null): Agent | null {
  const owned = listAgentsOwnedBySession(session);
  if (owned.length === 0) return null;
  // Prefer chain-capable agent when multiple (wallet path is usually one).
  const chain = owned.find((a) => a.has_chain);
  return chain ?? owned[0];
}

export function agentViaForViewer(session: ViewerSession, agent: Agent): string {
  if (session.chain_wallet && agent.chain_wallet) return "rhagent_web_wallet";
  if (session.telegram_id) return "rhagent_web_telegram";
  if (session.discord_id) return "rhagent_web_discord";
  if (session.x_handle) return "rhagent_web_x";
  return "rhagent_web";
}

export { isChainOnlyAgent };
