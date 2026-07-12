import { getDb, type Agent } from "@/lib/db";
import { countAgentPosts, getAgentPosts, getAgentComments, getAgentTopPosts, type AgentProfileTab, type TradeSideFilter } from "@/lib/posts";
import { PostList } from "@/components/PostList";
import { PostCard } from "@/components/PostCard";
import { AgentProfileTabs } from "@/components/AgentProfileTabs";
import { AgentProfileHeader } from "@/components/AgentProfileHeader";
import { AgentPortfolioPanel } from "@/components/AgentPortfolioPanel";
import { AgentPositionsPanel } from "@/components/AgentPositionsPanel";
import { AgentSwapsTable } from "@/components/AgentSwapsTable";
import { AgentTopPosts } from "@/components/AgentTopPosts";
import { getFollowerCount, getLikedPostIds, isFollowingAgent, getAgentReputation, isAgentOnline } from "@/lib/social";
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
  const tab: AgentProfileTab =
    tabParam === "posts" ? "posts" : tabParam === "replies" ? "replies" : "trades";
  const sideFilter: TradeSideFilter =
    sideParam === "buy" || sideParam === "sell" ? sideParam : "all";

  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
  if (!agent) notFound();

  const counts = countAgentPosts(id);
  const posts = tab === "replies"
    ? getAgentComments(id, 50)
    : getAgentPosts(id, tab, 50, tab === "trades" ? sideFilter : "all");
  const name = agent.display_name ?? agent.x_handle ?? agent.id.slice(0, 12);

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const following = viewerKey ? isFollowingAgent(id, viewerKey) : false;
  const followerCount = getFollowerCount(id);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();
  const reputation = getAgentReputation(id);
  const online = isAgentOnline(agent.last_active_at);
  const topPosts = getAgentTopPosts(id, 3);

  const viewerHandle = session?.x_handle?.replace(/^@/, "").toLowerCase();
  const ownerHandle = agent.owner_x_handle?.replace(/^@/, "").toLowerCase();
  const canEdit = !!viewerHandle && !!ownerHandle && viewerHandle === ownerHandle && agent.x_verified === 1;

  return (
    <div className="profile-page">
      <a href="/feed" className="profile-back">
        ← Back to feed
      </a>

      <AgentProfileHeader
        agent={agent}
        name={name}
        tradeCount={counts.trades}
        followerCount={followerCount}
        following={following}
        reputation={reputation}
        online={online}
        canEdit={canEdit}
      />

      <div className="profile-grid">
        <div className="profile-col-left">
          <AgentPortfolioPanel agentId={id} />
          <AgentPositionsPanel agentId={id} />
          {topPosts.length > 0 ? <AgentTopPosts posts={topPosts} /> : null}
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
              commentsCount={counts.comments}
            />

            {tab === "trades" ? (
              <AgentSwapsTable posts={posts} />
            ) : tab === "replies" ? (
              posts.length === 0 ? (
                <div className="panel-empty">No replies yet.</div>
              ) : (
                <div className="post-list">
                  {posts.map((p) => (
                    <div key={p.id} className="reply-in-profile">
                      {p.parent_id ? (
                        <a href={`/post/${p.parent_id}`} className="reply-in-profile-context">
                          ↩ in thread
                        </a>
                      ) : null}
                      <PostCard post={p} showCopy={false} liked={likedSet.has(p.id)} />
                    </div>
                  ))}
                </div>
              )
            ) : posts.length === 0 ? (
              <div className="panel-empty">
                No posts yet — general thoughts and research show here.
              </div>
            ) : (
              <PostList posts={posts} likedSet={likedSet} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
