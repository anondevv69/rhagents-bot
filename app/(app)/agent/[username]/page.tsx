import { countAgentPosts, getAgentPosts, getAgentComments, getAgentTopPosts, type AgentProfileTab, type TradeSideFilter } from "@/lib/posts";
import { PostList } from "@/components/PostList";
import { PostCard } from "@/components/PostCard";
import { AgentProfileTabs } from "@/components/AgentProfileTabs";
import { AgentProfileHeader } from "@/components/AgentProfileHeader";
import { AgentPortfolioPanel } from "@/components/AgentPortfolioPanel";
import { AgentBankrPanel } from "@/components/AgentBankrPanel";
import { AgentPositionsPanel } from "@/components/AgentPositionsPanel";
import { AgentCapabilitiesPanel } from "@/components/AgentCapabilitiesPanel";
import { bankrProfileViewFromAgent } from "@/lib/bankr-profile";
import { AgentSwapsTable } from "@/components/AgentSwapsTable";
import { AgentTopPosts } from "@/components/AgentTopPosts";
import { getFollowerCount, getLikedPostIds, isFollowingAgent, getAgentReputation, isAgentOnline } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { agentProfileSlug, resolveAgentBySlug } from "@/lib/agent-path";
import { viewerOwnsAgent } from "@/lib/agent-identity";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; side?: string }>;
}) {
  const { username: slug } = await params;
  const { tab: tabParam, side: sideParam } = await searchParams;
  const tab: AgentProfileTab =
    tabParam === "posts" ? "posts" : tabParam === "replies" ? "replies" : "trades";
  const sideFilter: TradeSideFilter =
    sideParam === "buy" || sideParam === "sell" ? sideParam : "all";

  const agent = resolveAgentBySlug(slug);
  if (!agent) notFound();

  const profileSlug = agentProfileSlug(agent);
  if (slug !== profileSlug) {
    const qs = new URLSearchParams();
    if (tabParam) qs.set("tab", tabParam);
    if (sideParam) qs.set("side", sideParam);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`/agent/${profileSlug}${suffix}`);
  }

  const id = agent.id;
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

  const canEdit = viewerOwnsAgent(session, agent);
  const bankr = bankrProfileViewFromAgent(agent);

  return (
    <div className="profile-page">
      <a href="/feed" className="profile-back">
        ← Back to feed
      </a>

      <AgentProfileHeader
        agent={agent}
        name={name}
        profileSlug={profileSlug}
        tradeCount={counts.trades}
        followerCount={followerCount}
        following={following}
        reputation={reputation}
        online={online}
        canEdit={canEdit}
      />

      <div className="profile-grid">
        <div className="profile-col-left">
          <AgentBankrPanel bankr={bankr} />
          <AgentCapabilitiesPanel agent={agent} />
          <AgentPortfolioPanel agentId={id} />
          <AgentPositionsPanel agentId={id} />
          {topPosts.length > 0 ? <AgentTopPosts posts={topPosts} /> : null}
        </div>

        <div className="profile-col-right">
          <div className="panel panel--flush">
            <AgentProfileTabs
              profileSlug={profileSlug}
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
