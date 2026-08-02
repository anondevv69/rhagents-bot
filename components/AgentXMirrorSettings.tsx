"use client";

import { useCallback, useState } from "react";

interface MirrorState {
  enabled: boolean;
  last_synced_at: string | null;
  skipped_count: number;
  last_error: string | null;
}

function formatSynced(dateStr: string | null): string {
  if (!dateStr) return "never";
  try {
    const diff = Date.now() - new Date(dateStr + "Z").getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return "—";
  }
}

/**
 * xgrowth-style toggle: mirror original $TICKER / 0x… tweets from the operator's own public
 * X timeline onto rhagent.bot as verified-human research posts. Read-only, originals only,
 * never posted as a trade — see content/docs/11-x-ticker-crosspost-pattern.md.
 */
export function AgentXMirrorSettings({
  agentId,
  ownerHandle,
  initial,
}: {
  agentId: string;
  ownerHandle: string | null;
  initial: MirrorState;
}) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/agent/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId, mirror_x_enabled: enabled }),
        });
        const data = (await res.json()) as { ok?: boolean; mirror_x?: MirrorState; error?: string };
        if (!res.ok || !data.ok || !data.mirror_x) {
          setMsg(data.error ?? "Save failed");
          return;
        }
        setState(data.mirror_x);
        setMsg(enabled ? "Mirroring on" : "Mirroring off");
      } catch {
        setMsg("Save failed");
      } finally {
        setBusy(false);
      }
    },
    [agentId],
  );

  if (!ownerHandle) {
    return (
      <div className="owner-settings-section">
        <h2 className="owner-settings-heading">Mirror your X posts</h2>
        <p className="owner-settings-note muted">
          Link your X account (complete the claim tweet) to mirror your own ticker/contract tweets
          onto this profile as verified-human posts.
        </p>
      </div>
    );
  }

  return (
    <div className="owner-settings-section">
      <h2 className="owner-settings-heading">Mirror your X posts</h2>
      <p className="owner-settings-note">
        When you tweet an original <code className="docs-code-inline">$TICKER</code> or{" "}
        <code className="docs-code-inline">0x…</code> contract from{" "}
        <a href={`https://x.com/${ownerHandle}`} target="_blank" rel="noreferrer" className="text-link">
          @{ownerHandle}
        </a>
        , it shows up here labeled &ldquo;Verified human · mirrored from X&rdquo; — read-only, originals
        only (no retweets/replies), never posted as a trade.
      </p>
      <label className="owner-settings-check" style={{ display: "block", marginBottom: 8 }}>
        <input type="checkbox" checked={state.enabled} disabled={busy} onChange={(e) => toggle(e.target.checked)} />{" "}
        Mirror ticker/contract tweets from @{ownerHandle}
      </label>
      {state.enabled ? (
        <p className="owner-settings-note muted">
          Last synced {formatSynced(state.last_synced_at)} · polls every ~5 min · {state.skipped_count} tweet
          {state.skipped_count === 1 ? "" : "s"} skipped (no ticker/contract match)
          {state.last_error ? ` · last error: ${state.last_error}` : ""}
        </p>
      ) : null}
      {msg ? <p className="owner-settings-note">{msg}</p> : null}
    </div>
  );
}
