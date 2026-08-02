"use client";

import { useState } from "react";
import type { Agent } from "@/lib/db";
import { formatLastActive } from "@/lib/format-time";
import { iaBadgeClass, iaBadgeLabel } from "@/lib/ia-concept-format";
import { agentCapabilityBadges, capabilityBadgeLabel } from "@/lib/product-badge";
import { isAgentUnverified } from "@/lib/agent-verified-ui";
import { mcpConnectionStatus, formatMcpLastUsed } from "@/lib/agent-connection";
import { AgentAvatar } from "./AgentAvatar";
import { FollowButton } from "./FollowButton";
import { AgentProfileEditModal } from "./AgentProfileEditModal";
import { ActiveSkillBadge } from "./ActiveSkillBadge";

function formatJoined(dateStr: string): string {
  try {
    return new Date(dateStr + "Z").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function normHandle(h: string | null | undefined): string {
  return (h ?? "").replace(/^@/, "").toLowerCase();
}

function agentProductBadges(agent: Agent) {
  return agentCapabilityBadges(agent);
}

export function AgentProfileHeader({
  agent,
  name,
  profileSlug,
  followerCount,
  following,
  online,
  canEdit,
}: {
  agent: Agent;
  name: string;
  profileSlug: string;
  tradeCount: number;
  followerCount: number;
  following: boolean;
  reputation: number;
  online: boolean;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);

  const handle = agent.x_handle?.replace(/^@/, "");
  const ownerHandle = agent.owner_x_handle?.replace(/^@/, "");
  const ownerName = agent.owner_display_name;
  const handlesMatch = handle && ownerHandle && normHandle(handle) === normHandle(ownerHandle);
  const showAgentHandle = !!handle && !handlesMatch;
  const lastActive = formatLastActive(agent.last_active_at);
  const badges = agentProductBadges(agent);
  const connection = mcpConnectionStatus(agent);
  const mcpLastUsedLabel = formatMcpLastUsed(connection.last_used_at);

  const ownerMeta = ownerHandle ? (
    <>
      {" · "}
      <a href={`https://x.com/${ownerHandle}`} target="_blank" rel="noreferrer" className="text-link">
        @{ownerHandle} on X
      </a>
    </>
  ) : agent.owner_telegram_username ? (
    <>
      {" · "}
      <a
        href={`https://t.me/${agent.owner_telegram_username.replace(/^@/, "")}`}
        target="_blank"
        rel="noreferrer"
        className="text-link"
      >
        @{agent.owner_telegram_username.replace(/^@/, "")} on Telegram
      </a>
    </>
  ) : agent.owner_discord_username ? (
    <> · @{agent.owner_discord_username} on Discord</>
  ) : null;

  return (
    <>
      <div className="ia-concept-profile-header">
        <div className="ia-concept-avatar-lg ia-concept-avatar-lg--photo">
          <AgentAvatar
            name={name}
            xHandle={agent.x_handle}
            ownerHandle={agent.owner_x_handle}
            profileSlug={profileSlug}
            size={64}
            fontSize={24}
          />
          {online ? <span className="profile-online-dot" title="Online" /> : null}
        </div>

        <div className="ia-concept-profile-main">
          <div className="ia-concept-profile-name-row">
            <h1 className="ia-concept-profile-name">{name}</h1>
            {badges.map((b) => (
              <span key={b} className={iaBadgeClass(b)}>
                {capabilityBadgeLabel(b)}
              </span>
            ))}
            {isAgentUnverified(agent) ? (
              <span className="badge badge-unverified" title="Complete X claim to verify this agent">
                Unverified
              </span>
            ) : agent.x_verified ? (
              <span className="badge badge-verified">verified</span>
            ) : null}
            {connection.state !== "offline" ? (
              <span
                className={`agent-connection-pill${connection.state === "recent" ? " agent-connection-pill--idle" : ""}`}
                title={
                  connection.state === "active"
                    ? "This agent made an MCP call in the last 20 minutes — it's connected and working right now."
                    : `Last connected over MCP ${mcpLastUsedLabel ?? "recently"}${connection.last_client_label ? ` via ${connection.last_client_label}` : ""}`
                }
              >
                <span className={`agent-connection-dot${connection.state === "active" ? " agent-connection-dot--pulse" : ""}`} />
                {connection.state === "active" ? "Agent working now" : `Agent connected · ${mcpLastUsedLabel}`}
              </span>
            ) : null}
          </div>

          <p className={`ia-concept-profile-bio${agent.bio ? "" : " ia-concept-profile-bio--empty"}`}>
            {agent.bio ??
              (canEdit
                ? "Add a bio — tell people what this agent trades or researches."
                : "No bio yet.")}
          </p>

          {agent.active_skill_name ? (
            <div className="profile-active-skill">
              <span className="profile-active-skill-label">Running</span>
              <ActiveSkillBadge name={agent.active_skill_name} />
            </div>
          ) : null}

          <p className="ia-concept-profile-meta">
            joined {formatJoined(agent.created_at)}
            {ownerMeta}
            {showAgentHandle ? (
              <>
                {" · "}
                <a href={`https://x.com/${handle}`} target="_blank" rel="noreferrer" className="text-link">
                  @{handle}
                </a>
              </>
            ) : null}
            {!online && lastActive ? ` · active ${lastActive}` : null}
            {agent.bankr_wallet ? " · Bankr wallet" : ""}
          </p>
        </div>

        <div className="ia-concept-profile-actions">
          {canEdit ? (
            <>
              <a href={`/agent/${profileSlug}/settings`} className="btn btn-ghost">
                Settings
              </a>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          ) : null}
          <FollowButton agentId={agent.id} initialFollowing={following} followerCount={followerCount} />
        </div>
      </div>

      {canEdit ? (
        <AgentProfileEditModal
          agent={agent}
          name={name}
          profileSlug={profileSlug}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
