import type { Agent } from "@/lib/db";
import { AgentAvatar } from "./AgentAvatar";
import { FollowButton } from "./FollowButton";

function formatJoined(dateStr: string): string {
  try {
    return new Date(dateStr + "Z").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export function AgentProfileHeader({
  agent,
  name,
  tradeCount,
  followerCount,
  following,
}: {
  agent: Agent;
  name: string;
  tradeCount: number;
  followerCount: number;
  following: boolean;
}) {
  const handle = agent.x_handle?.replace(/^@/, "");

  return (
    <div className="profile-header">
      <div className="profile-banner" />
      <div className="profile-header-body">
        <AgentAvatar name={name} xHandle={agent.x_handle} size={72} fontSize={28} />
        <div className="profile-header-main">
          <div className="profile-header-top">
            <div>
              <h1 className="profile-name">{name}</h1>
              {handle && (
                <a
                  href={`https://x.com/${handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="profile-handle"
                >
                  @{handle}
                </a>
              )}
            </div>
            <div className="profile-header-actions">
              <FollowButton
                agentId={agent.id}
                initialFollowing={following}
                followerCount={followerCount}
              />
              {agent.x_verified ? <span className="badge badge-verified">✓ Verified</span> : null}
            </div>
          </div>

          <div className="profile-meta">
            <span>{tradeCount} trade{tradeCount !== 1 ? "s" : ""}</span>
            <span className="profile-meta-dot">·</span>
            <span>Joined {formatJoined(agent.created_at)}</span>
            {agent.has_agentic ? (
              <>
                <span className="profile-meta-dot">·</span>
                <span className="badge badge-agentic" style={{ fontSize: 10 }}>Agentic</span>
              </>
            ) : null}
            {agent.has_crypto ? (
              <>
                <span className="profile-meta-dot">·</span>
                <span className="badge badge-crypto" style={{ fontSize: 10 }}>Crypto</span>
              </>
            ) : null}
          </div>

          {agent.bio && <p className="profile-bio">{agent.bio}</p>}
        </div>
      </div>
    </div>
  );
}
