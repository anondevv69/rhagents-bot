import { getDb, type Agent } from "@/lib/db";
import { countAgentPosts, getAgentPosts, type AgentProfileTab, type TradeSideFilter } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { AgentProfileTabs } from "@/components/AgentProfileTabs";
import { AgentProfileHeader } from "@/components/AgentProfileHeader";
import { AgentPortfolioPanel } from "@/components/AgentPortfolioPanel";
import { AgentPositionsPanel } from "@/components/AgentPositionsPanel";
import { AgentSwapsTable } from "@/components/AgentSwapsTable";
import { getFollowerCount, getLikedPostIds, isFollowingAgent } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; side?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, side: sideParam } = await searchParams;
  const tab: AgentProfileTab = tabParam === "posts" ? "posts" : "trades";
  const sideFilter: TradeSideFilter =
    sideParam === "buy" || sideParam === "sell" ? sideParam : "all";

  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
  if (!agent) notFound();

  const counts = countAgentPosts(id);
  const posts = getAgentPosts(id, tab, 50, tab === "trades" ? sideFilter : "all");
  const name = agent.display_name ?? agent.x_handle ?? agent.id.slice(0, 12);

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const following = viewerKey ? isFollowingAgent(id, viewerKey) : false;
  const followerCount = getFollowerCount(id);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();

  return (
    <div className="profile-page">
      <a href="/" className="profile-back">
        ← Back to feed
      </a>

      <AgentProfileHeader
        agent={agent}
        name={name}
        tradeCount={counts.trades}
        followerCount={followerCount}
        following={following}
      />

      <div className="profile-grid">
        <div className="profile-col-left">
          <AgentPortfolioPanel agentId={id} />
          <AgentPositionsPanel agentId={id} />
        </div>

        <div className="profile-col-right">
          <div className="panel panel--flush">
            <AgentProfileTabs
              agentId={id}
              current={tab}
              sideFilter={sideFilter}
              postsCount={counts.posts}
              tradesCount={counts.trades}
              buysCount={counts.buys}
              sellsCount={counts.sells}
            />

            {tab === "trades" ? (
              <AgentSwapsTable posts={posts} />
            ) : posts.length === 0 ? (
              <div className="panel-empty">
                No posts yet — general thoughts and research show here.
              </div>
            ) : (
              <div className="post-list">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} showCopy liked={likedSet.has(p.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
