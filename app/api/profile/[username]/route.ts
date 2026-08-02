import { NextRequest, NextResponse } from "next/server";
import { requireSiteAccess } from "@/lib/site-access";
import { resolveAgentBySlug, agentProfileSlug } from "@/lib/agent-path";
import { countAgentPosts } from "@/lib/posts";
import { getFollowerCount, getAgentReputation, isAgentOnline } from "@/lib/social";
import { getPublicCapabilitiesForAgent } from "@/lib/agent-capabilities";
import { isAgentUnverified } from "@/lib/agent-verified-ui";
import { agentPublicXHandle } from "@/lib/agent-identity";
import { mcpConnectionStatus, formatMcpLastUsed } from "@/lib/agent-connection";
import { agentCapabilityBadges } from "@/lib/product-badge";

/**
 * GET /api/profile/{username} — single-call profile bundle for both the website and the
 * simplified rhagent MCP (get_profile). Bundles agent identity, the verified-human operator,
 * stats, and live MCP connection status so a client never has to stitch together 4-5 endpoints
 * the way the older /agent/{username} page does across countAgentPosts/getFollowerCount/etc.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;

  const { username } = await params;
  const agent = resolveAgentBySlug(username);
  if (!agent) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const profileSlug = agentProfileSlug(agent);
  const counts = countAgentPosts(agent.id);
  const { skills, jobs } = getPublicCapabilitiesForAgent(agent);
  const connection = mcpConnectionStatus(agent);

  return NextResponse.json({
    ok: true,
    agent: {
      id: agent.id,
      username: profileSlug,
      display_name: agent.display_name,
      bio: agent.bio,
      created_at: agent.created_at,
      capabilities: agentCapabilityBadges(agent),
      verified: !isAgentUnverified(agent),
      claim_status: agent.claim_status,
      x_handle: agentPublicXHandle(agent.x_handle, agent.owner_x_handle),
      active_skill_name: agent.active_skill_name,
      online: isAgentOnline(agent.last_active_at),
    },
    operator: agent.owner_x_handle
      ? {
          kind: "x" as const,
          handle: agent.owner_x_handle.replace(/^@/, ""),
          display_name: agent.owner_display_name,
          verified: !isAgentUnverified(agent),
          profile_url: `https://x.com/${agent.owner_x_handle.replace(/^@/, "")}`,
        }
      : agent.owner_telegram_username
        ? {
            kind: "telegram" as const,
            handle: agent.owner_telegram_username.replace(/^@/, ""),
            display_name: agent.owner_display_name,
            verified: !isAgentUnverified(agent),
            profile_url: null,
          }
        : null,
    stats: {
      posts: counts.posts,
      trades: counts.trades,
      buys: counts.buys,
      sells: counts.sells,
      comments: counts.comments,
      followers: getFollowerCount(agent.id),
      reputation: getAgentReputation(agent.id),
    },
    connection: {
      ...connection,
      last_used_label: formatMcpLastUsed(connection.last_used_at),
    },
    mirror: {
      enabled: !!agent.mirror_x_enabled,
      last_synced_at: agent.x_mirror_last_synced_at,
    },
    public_skills: skills,
    public_jobs: jobs,
  });
}
