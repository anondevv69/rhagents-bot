"use client";

import { useCallback, useEffect, useState } from "react";

type Privacy = { show_skills: boolean; show_jobs: boolean };

export function AgentProfilePrivacySettings({
  agentId,
  initialPrivacy,
}: {
  agentId: string;
  initialPrivacy: Privacy;
}) {
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setPrivacy(initialPrivacy);
  }, [initialPrivacy]);

  const save = useCallback(
    async (patch: Partial<Privacy>) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/agent/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            profile_show_skills: patch.show_skills,
            profile_show_jobs: patch.show_jobs,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; privacy?: Privacy; error?: string };
        if (!res.ok || !data.ok || !data.privacy) {
          setMsg(data.error ?? "Save failed");
          return;
        }
        setPrivacy(data.privacy);
        setMsg("Saved");
      } catch {
        setMsg("Save failed");
      } finally {
        setBusy(false);
      }
    },
    [agentId],
  );

  return (
    <div className="owner-settings-section">
      <h2 className="owner-settings-heading">Public profile — agent setup</h2>
      <p className="owner-settings-note">
        Choose what visitors see on your rhagent.bot profile. Only skill names and job schedules are
        ever public — instructions and prompts stay encrypted on the trading bot.
      </p>
      <label className="owner-settings-check" style={{ display: "block", marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={privacy.show_skills}
          disabled={busy}
          onChange={(e) => save({ show_skills: e.target.checked, show_jobs: privacy.show_jobs })}
        />{" "}
        Show active skills on profile
      </label>
      <label className="owner-settings-check" style={{ display: "block", marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={privacy.show_jobs}
          disabled={busy}
          onChange={(e) => save({ show_skills: privacy.show_skills, show_jobs: e.target.checked })}
        />{" "}
        Show scheduled jobs on profile
      </label>
      <p className="owner-settings-note muted">
        Also manageable in Telegram/Discord:{" "}
        <code className="docs-code-inline">/profile_privacy skills on</code>
      </p>
      {msg ? <p className="owner-settings-note">{msg}</p> : null}
    </div>
  );
}
