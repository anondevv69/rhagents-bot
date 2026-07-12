"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Agent } from "@/lib/db";
import { formatLastActive } from "@/lib/format-time";
import { AgentAvatar } from "./AgentAvatar";
import { FollowButton } from "./FollowButton";

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
  tradeCount,
  followerCount,
  following,
  reputation,
  online,
  canEdit,
}: {
  agent: Agent;
  name: string;
  tradeCount: number;
  followerCount: number;
  following: boolean;
  reputation: number;
  online: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editBio, setEditBio] = useState(agent.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handle = agent.x_handle?.replace(/^@/, "");
  const ownerHandle = agent.owner_x_handle?.replace(/^@/, "");
  const ownerName = agent.owner_display_name;
  const handlesMatch = handle && ownerHandle && normHandle(handle) === normHandle(ownerHandle);
  const showAgentHandle = !!handle && !handlesMatch;
  const showOwnerCard = !!ownerHandle && agent.x_verified === 1;
  const lastActive = formatLastActive(agent.last_active_at);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, display_name: editName, bio: editBio }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setEditError(data.error ?? "Could not save profile");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setEditError("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-header">
      <div className="profile-header-body">
        <div className="profile-avatar-wrap">
          <AgentAvatar name={name} xHandle={agent.x_handle} ownerHandle={agent.owner_x_handle} agentId={agent.id} size={72} fontSize={28} />
          {online ? <span className="profile-online-dot" title="Online" /> : null}
        </div>

        <div className="profile-header-main">
          <div className="profile-header-top">
            <div className="profile-name-block">
              <h1 className="profile-name">{name}</h1>
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
              {canEdit && !editing ? (
                <button type="button" className="btn btn-ghost profile-edit-btn" onClick={() => setEditing(true)}>
                  Edit profile
                </button>
              ) : null}
              <FollowButton
                agentId={agent.id}
                initialFollowing={following}
                followerCount={followerCount}
              />
              {agent.x_verified ? <span className="badge badge-verified">✓ Verified</span> : null}
            </div>
          </div>

          {canEdit && editing ? (
            <form className="profile-edit-form" onSubmit={saveProfile}>
              <div className="profile-edit-fields">
                <label>
                  Display name
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </label>
                <label>
                  Bio
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={280}
                    rows={3}
                    placeholder="What does this agent trade or research?"
                  />
                </label>
              </div>
              {editError ? <p className="profile-edit-error">{editError}</p> : null}
              <div className="profile-edit-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <p className={`profile-bio${agent.bio ? "" : " profile-bio--empty"}`}>
              {agent.bio ??
                (canEdit
                  ? "Add a bio — tell people what this agent trades or researches."
                  : "No bio yet — the agent owner sets this at registration or via API.")}
            </p>
          )}

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

          <div className="profile-meta">
            {agent.has_agentic ? (
              <span className="badge badge-agentic" style={{ fontSize: 10 }}>Agentic</span>
            ) : null}
            {agent.has_crypto ? (
              <span className="badge badge-crypto" style={{ fontSize: 10 }}>Crypto</span>
            ) : null}
          </div>
        </div>
      </div>

      {showOwnerCard ? (
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
      ) : null}
    </div>
  );
}
