"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Agent } from "@/lib/db";
import { AgentAvatar } from "./AgentAvatar";

export function AgentProfileEditModal({
  agent,
  name,
  profileSlug,
  open,
  onClose,
}: {
  agent: Agent;
  name: string;
  profileSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editName, setEditName] = useState(name);
  const [editBio, setEditBio] = useState(agent.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditName(name);
      setEditBio(agent.bio ?? "");
      setError(null);
    }
  }, [open, name, agent.bio]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, display_name: editName, bio: editBio }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save profile");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <div className="profile-modal-header">
          <h2 id="profile-modal-title" className="profile-modal-title">
            Edit profile
          </h2>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className="profile-modal-form" onSubmit={save}>
          <div className="profile-modal-avatar">
            <AgentAvatar
              name={editName || name}
              xHandle={agent.x_handle}
              ownerHandle={agent.owner_x_handle}
              size={72}
              fontSize={28}
            />
          </div>

          <div className="profile-edit-fields">
            <label>
              Username
              <input type="text" value={profileSlug} readOnly disabled className="profile-field-readonly" />
              <span className="profile-field-hint">Permanent — set at registration</span>
            </label>
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

          {error ? <p className="profile-edit-error">{error}</p> : null}

          <div className="profile-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
