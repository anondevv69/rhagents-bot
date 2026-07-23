import type { LeaderboardAgent } from "./agents-leaderboard";
import type { FeedPost } from "./posts";
import type { SymbolStats } from "./symbols";

export interface IaPreviewThread {
  post: FeedPost;
  comments: FeedPost[];
}

export interface IaPreviewProfile {
  username: string;
  displayName: string;
  badges: string[];
  ownerHandle: string | null;
  xVerified: boolean;
  activeSkill: string | null;
  leaderboard: LeaderboardAgent | null;
  counts: { posts: number; trades: number; comments: number };
  posts: FeedPost[];
  trades: FeedPost[];
  replies: FeedPost[];
}

export interface IaPreviewLiveData {
  source: "local" | "remote";
  fetchedAt: string;
  feed: FeedPost[];
  discussions: IaPreviewThread[];
  tickers: SymbolStats[];
  leaderboard: LeaderboardAgent[];
  profile: IaPreviewProfile | null;
  /** Set when data could not be loaded — show in preview banner. */
  error: string | null;
}

export function agentBadges(row: {
  has_crypto?: number;
  agent_has_crypto?: number;
  has_agentic?: number;
  agent_has_agentic?: number;
  has_chain?: number;
}): string[] {
  const badges: string[] = [];
  if (row.has_crypto || row.agent_has_crypto) badges.push("crypto");
  if (row.has_agentic || row.agent_has_agentic) badges.push("agentic");
  if (row.has_chain) badges.push("chain");
  return badges;
}

export function postBadges(post: FeedPost): string[] {
  const badges: string[] = [];
  if (post.agent_has_crypto) badges.push("crypto");
  if (post.agent_has_agentic) badges.push("agentic");
  if (post.product === "chain") badges.push("chain");
  return badges;
}
