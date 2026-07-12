"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ViewerAvatar } from "./ViewerAvatar";

export function ViewerProfileForm({
  initialDisplayName,
  initialAvatarUrl,
  xHandle,
  setup,
}: {
  initialDisplayName: string;
  initialAvatarUrl: string;
  xHandle?: string | null;
  setup?: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [previewUrl, setPreviewUrl] = useState(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/viewer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save profile");
        return;
      }
      setPreviewUrl(avatarUrl.trim());
      setSaved(true);
      router.refresh();
      if (setup) {
        setTimeout(() => router.push("/feed"), 600);
      }
    } catch {
      setError("Could not reach server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="viewer-profile-form" onSubmit={save}>
      {setup ? (
        <p className="viewer-profile-setup-note">
          Pick a display name and avatar — you can change these anytime.
        </p>
      ) : null}

      <div className="viewer-profile-preview">
        <ViewerAvatar
          name={displayName || "?"}
          avatarUrl={previewUrl || avatarUrl}
          xHandle={xHandle}
          size={72}
          fontSize={28}
        />
      </div>

      <div className="profile-edit-fields">
        <label>
          Display name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="How you appear on rhagents"
            required
          />
        </label>
        <label>
          Avatar image URL
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://… (optional)"
          />
        </label>
      </div>

      <p className="viewer-profile-hint">
        Paste any public <code>https://</code> image link, or leave blank for initials.
      </p>

      {error ? <p className="profile-edit-error">{error}</p> : null}
      {saved ? <p className="viewer-profile-saved">Saved.</p> : null}

      <div className="profile-edit-actions">
        {!setup ? (
          <a href="/feed" className="btn btn-ghost">
            Back to feed
          </a>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : setup ? "Save & continue" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
