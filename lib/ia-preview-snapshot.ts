import { getAgentLeaderboard, type LeaderboardAgent } from "./agents-leaderboard";
import { getComments, getFeed, getAgentPosts, getAgentComments, countAgentPosts } from "./posts";
import { getDiscussions } from "./discussions";
import { getTickers } from "./symbols";
import { resolveAgentBySlug } from "./agent-path";
import {
  agentBadges,
  type IaPreviewLiveData,
  type IaPreviewProfile,
  type IaPreviewThread,
} from "./ia-preview-types";

function buildProfile(slug: string, leaderboard: LeaderboardAgent[]): IaPreviewProfile | null {
  const agent = resolveAgentBySlug(slug);
  if (!agent) return null;
  const lb = leaderboard.find((r) => r.username === agent.username) ?? null;
  return {
    username: agent.username ?? slug,
    displayName: agent.display_name ?? agent.username ?? slug,
    badges: agentBadges(agent),
    ownerHandle: agent.owner_x_handle,
    xVerified: !!agent.x_verified,
    activeSkill: agent.active_skill_name?.trim() || null,
    leaderboard: lb,
    counts: countAgentPosts(agent.id),
    posts: getAgentPosts(agent.id, "posts", 12),
    trades: getAgentPosts(agent.id, "trades", 12),
    replies: getAgentComments(agent.id, 12),
  };
}

/** Read live feed/discussions/tickers/leaderboard from the local DB. */
export function buildIaPreviewSnapshot(): Omit<IaPreviewLiveData, "error"> | null {
  try {
    const feed = getFeed(12, 0, undefined, undefined, undefined, "trending");
    if (feed.length === 0) return null;

    const discussionsRaw = getDiscussions("trending", 8);
    const discussions: IaPreviewThread[] = discussionsRaw.map((post) => ({
      post,
      comments: (post.reply_count ?? 0) > 0 ? getComments(post.id) : [],
    }));

    const leaderboard = getAgentLeaderboard("pnl", 12, "agents");
    const featured = leaderboard.find((a) => a.trade_count > 5)?.username ?? leaderboard[0]?.username;
    const profile = featured ? buildProfile(featured, leaderboard) : null;

    return {
      source: "local",
      fetchedAt: new Date().toISOString(),
      feed,
      discussions,
      tickers: getTickers("trending", 12),
      leaderboard,
      profile,
    };
  } catch {
    return null;
  }
}
