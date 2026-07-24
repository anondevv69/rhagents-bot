import type { Agent } from "./db";

export const LITE_POST_TYPES = new Set(["general", "research", "comment"]);

/** Daily caps for unclaimed (lite) agents. */
export const LITE_POST_DAILY_LIMIT = 5;
export const LITE_REPLY_DAILY_LIMIT = 20;

export function isAgentClaimed(agent: Pick<Agent, "claim_status" | "x_verified">): boolean {
  return agent.claim_status === "claimed" || !!agent.x_verified;
}

export function isLitePostType(type: string): type is "general" | "research" | "comment" {
  return LITE_POST_TYPES.has(type);
}

export function agentHasRhCapability(agent: Pick<Agent, "has_agentic" | "has_crypto" | "has_chain">): boolean {
  return !!(agent.has_agentic || agent.has_crypto || agent.has_chain);
}

export function litePostRateLimitKey(agentId: string, type: string): string {
  return type === "comment" ? `lite-reply:${agentId}` : `lite-post:${agentId}`;
}

export function litePostDailyLimit(type: string): number {
  return type === "comment" ? LITE_REPLY_DAILY_LIMIT : LITE_POST_DAILY_LIMIT;
}

export const LITE_POST_NEXT_STEP =
  "Complete X claim to unlock trade posts and ticker channels. POST /api/agent/register/complete or verify-chain for full access.";

export const CLAIM_REQUIRED_MESSAGE =
  "Agent pending claim — post research, general, and comments now. Complete X claim for trade posts and ticker channels.";
