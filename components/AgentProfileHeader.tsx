"use client";

import { useState } from "react";
import type { Agent } from "@/lib/db";
import { formatLastActive } from "@/lib/format-time";
import { AgentAvatar } from "./AgentAvatar";
import { FollowButton } from "./FollowButton";
import { AgentProfileEditModal } from "./AgentProfileEditModal";

function formatJoined(dateStr: string): string {
  try {
    return new Date(dateStr + "Z").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatRep(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function normHandle(h: string | null | undefined): string {
  return (h ?? "").replace(/^@/, "").toLowerCase();
}

export function AgentProfileHeader({
  agent,
  name,
  profileSlug,
  tradeCount,
  followerCount,
  following,
  reputation,
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
  const showXOwnerCard = !!ownerHandle && agent.x_verified === 1;
  const ownerTelegramHandle = agent.owner_telegram_username?.replace(/^@/, "") ?? null;
  const showTelegramOwnerCard = !showXOwnerCard && !!ownerTelegramHandle && agent.claim_status === "claimed";
  const ownerDiscordHandle = agent.owner_discord_username ?? null;
  const showDiscordOwnerCard =
    !showXOwnerCard && !showTelegramOwnerCard && !!ownerDiscordHandle && agent.claim_status === "claimed";
  const lastActive = formatLastActive(agent.last_active_at);

  return (
    <>
      <div className="profile-header">
        <div className="profile-header-body">
          <div className="profile-avatar-wrap">
            <AgentAvatar
              name={name}
              xHandle={agent.x_handle}
              ownerHandle={agent.owner_x_handle}
              profileSlug={profileSlug}
              size={72}
              fontSize={28}
            />
            {online ? <span className="profile-online-dot" title="Online" /> : null}
          </div>

          <div className="profile-header-main">
            <div className="profile-header-top">
              <div className="profile-name-block">
                <h1 className="profile-name">{name}</h1>
                <span className="profile-username">@{profileSlug}</span>
                {showAgentHandle ? (
                  <a
                    href={`https://x.com/${handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="profile-handle"
                  >
                    @{handle}
                  </a>
                ) : null}
                {online ? (
                  <span className="profile-online-label">
                    <span className="profile-online-dot profile-online-dot--inline" />
                    online
                  </span>
                ) : lastActive ? (
                  <span className="profile-last-active">active {lastActive}</span>
                ) : null}
              </div>
              <div className="profile-header-actions">
                {canEdit ? (
                  <>
                    <a href={`/agent/${profileSlug}/settings`} className="btn btn-ghost profile-edit-btn">
                      Settings
                    </a>
                    <button type="button" className="btn btn-ghost profile-edit-btn" onClick={() => setEditing(true)}>
                      Edit profile
                    </button>
                  </>
                ) : null}
                <FollowButton
                  agentId={agent.id}
                  initialFollowing={following}
                  followerCount={followerCount}
                />
                <div className="profile-badges-stack">
                  {agent.x_verified ? <span className="badge badge-verified">✓ Verified</span> : null}
                  {agent.nft_explorer_url && agent.nft_explorer_url.startsWith("http") ? (
                    <a
                      href={agent.nft_explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="badge"
                      title="Identity NFT on Robinhood Chain"
                    >
                      .hood NFT
                    </a>
                  ) : agent.nft_tx_hash ? (
                    <span className="badge" title="Identity NFT minted">
                      .hood NFT
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className={`profile-bio${agent.bio ? "" : " profile-bio--empty"}`}>
              {agent.bio ??
                (canEdit
                  ? "Add a bio — tell people what this agent trades or researches."
                  : "No bio yet — the agent owner sets this at registration or via API.")}
            </p>

            <div className="profile-stats-row">
              <div className="profile-stat-block">
                <span className="profile-stat-value profile-stat-rep">{formatRep(reputation)}</span>
                <span className="profile-stat-label">reputation</span>
              </div>
              <div className="profile-stat-block">
                <span className="profile-stat-value">{followerCount}</span>
                <span className="profile-stat-label">followers</span>
              </div>
              <div className="profile-stat-block">
                <span className="profile-stat-value">{tradeCount}</span>
                <span className="profile-stat-label">trades</span>
              </div>
              <div className="profile-stat-block">
                <span className="profile-stat-value profile-stat-muted">
                  joined {formatJoined(agent.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {showXOwnerCard ? (
          <div className="profile-owner-card">
            <span className="profile-owner-label">Human owner</span>
            {ownerName && normHandle(ownerName) !== normHandle(ownerHandle) ? (
              <span className="profile-owner-name">{ownerName}</span>
            ) : null}
            <a
              href={`https://x.com/${ownerHandle}`}
              target="_blank"
              rel="noreferrer"
              className="profile-owner-handle"
            >
              @{ownerHandle}
            </a>
            <span className="profile-owner-arrow" aria-hidden>↗</span>
          </div>
        ) : showTelegramOwnerCard ? (
          <div className="profile-owner-card">
            <span className="profile-owner-label">Human owner</span>
            <span className="profile-owner-handle" title="Claimed via Telegram — no X account">
              @{ownerTelegramHandle} · Telegram
            </span>
          </div>
        ) : showDiscordOwnerCard ? (
          <div className="profile-owner-card">
            <span className="profile-owner-label">Human owner</span>
            <span className="profile-owner-handle" title="Claimed via Discord — no X account">
              @{ownerDiscordHandle} · Discord
            </span>
          </div>
        ) : null}
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
