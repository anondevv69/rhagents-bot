import { isAgentClaimed } from "@/lib/agent-tier";
import type { FeedPost } from "@/lib/posts";
import type { Agent } from "@/lib/db";

export function isPostAgentUnverified(post: Pick<FeedPost, "agent_claimed" | "agent_x_verified">): boolean {
  return !post.agent_claimed && !post.agent_x_verified;
}

export function isAgentUnverified(agent: Pick<Agent, "claim_status" | "x_verified">): boolean {
  return !isAgentClaimed(agent);
}
