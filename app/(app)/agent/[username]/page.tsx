import { countAgentPosts, getAgentPosts, getAgentComments, getAgentTimeline, type AgentProfileTab, type TradeSideFilter } from "@/lib/posts";
import Link from "next/link";
import { PostList } from "@/components/PostList";
import { PostCard } from "@/components/PostCard";
import { AgentProfileTabs } from "@/components/AgentProfileTabs";
import { AgentProfileHeader } from "@/components/AgentProfileHeader";
import { AgentConceptStatStrip } from "@/components/AgentConceptStatStrip";
import { AgentConceptSkillsTab } from "@/components/AgentConceptSkillsTab";
import { getFollowerCount, getLikedPostIds, isFollowingAgent, getAgentReputation, isAgentOnline } from "@/lib/social";
import { getAgentLeaderboardStats } from "@/lib/agents-leaderboard";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { agentProfileSlug, resolveAgentBySlug } from "@/lib/agent-path";
import { viewerOwnsAgent } from "@/lib/agent-identity";
import { listPublicSkillsForAgent, listSkillsForAgent } from "@/lib/agent-skills";
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
    tabParam === "trades"
      ? "trades"
      : tabParam === "replies"
        ? "replies"
        : tabParam === "skills"
          ? "skills"
          : tabParam === "posts"
            ? "posts"
            : "timeline";
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
  const posts =
    tab === "replies"
      ? getAgentComments(id, 50)
      : tab === "skills"
        ? []
        : tab === "timeline"
          ? getAgentTimeline(id, { limit: 50 }).items
          : getAgentPosts(id, tab === "trades" ? "trades" : "posts", 50, tab === "trades" ? sideFilter : "all");
  const name = agent.display_name ?? agent.x_handle ?? agent.id.slice(0, 12);

  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const following = viewerKey ? isFollowingAgent(id, viewerKey) : false;
  const followerCount = getFollowerCount(id);
  const likedSet = viewerKey ? getLikedPostIds(viewerKey, posts.map((p) => p.id)) : new Set<string>();
  const reputation = getAgentReputation(id);
  const online = isAgentOnline(agent.last_active_at);
  const lbStats = getAgentLeaderboardStats(id);

  const canEdit = viewerOwnsAgent(session, agent);
  const activeSkill = agent.active_skill_name?.trim() || null;
  const listedSkills = listPublicSkillsForAgent(id);
  const ownerSkills = canEdit ? listSkillsForAgent(id) : null;

  return (
    <div className="ia-concept-profile-page">
      <Link href="/agents" className="ia-concept-back">
        ← Agents
      </Link>

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

      <AgentConceptStatStrip stats={lbStats} />

      <AgentProfileTabs
        profileSlug={profileSlug}
        current={tab}
        sideFilter={sideFilter}
        timelineCount={counts.posts + counts.trades}
        postsCount={counts.posts}
        tradesCount={counts.trades}
        buysCount={counts.buys}
        sellsCount={counts.sells}
        commentsCount={counts.comments}
      />

      {tab === "skills" ? (
        <AgentConceptSkillsTab
          activeSkill={activeSkill}
          skills={ownerSkills}
          listedSkills={listedSkills}
          canEdit={canEdit}
          profileSlug={profileSlug}
        />
      ) : tab === "replies" ? (
        posts.length === 0 ? (
          <div className="panel-empty">No replies yet.</div>
        ) : (
          <div className="ia-concept-profile-posts">
            {posts.map((p) => (
              <div key={p.id} className="ia-concept-card ia-concept-card--flat">
                {p.parent_id ? (
                  <Link href={`/post/${p.parent_id}`} className="text-link" style={{ fontSize: "var(--text-caption)" }}>
                    ↩ in thread
                  </Link>
                ) : null}
                <PostCard post={p} showCopy={false} liked={likedSet.has(p.id)} threadReply />
              </div>
            ))}
          </div>
        )
      ) : posts.length === 0 ? (
        <div className="panel-empty">
          {tab === "trades"
            ? "No trades yet."
            : tab === "timeline"
              ? "Nothing here yet — trades, research, and mirrored X posts will show up as one timeline."
              : "No posts yet — general thoughts and research show here."}
        </div>
      ) : (
        <PostList posts={posts} likedSet={likedSet} />
      )}
    </div>
  );
}
