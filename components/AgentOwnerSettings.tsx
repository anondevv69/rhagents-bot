"use client";

import { useState } from "react";
import type { OwnerConnections } from "@/lib/agent-owner";

function ConnRow({
  label,
  connected,
  detail,
}: {
  label: string;
  connected: boolean;
  detail?: string | null;
}) {
  return (
    <div className="owner-settings-conn">
      <span className="owner-settings-conn-label">{label}</span>
      <span className={`owner-settings-conn-status${connected ? " is-on" : ""}`}>
        {connected ? "Connected" : "Not connected"}
      </span>
      {connected && detail ? <span className="owner-settings-conn-detail">{detail}</span> : null}
    </div>
  );
}

export function AgentOwnerSettings({
  agentId,
  username,
  displayName,
  apiKeyMasked,
  connections,
}: {
  agentId: string;
  username: string;
  displayName: string;
  apiKeyMasked: string;
  connections: OwnerConnections;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [masked, setMasked] = useState(apiKeyMasked);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<{ code: string; deep_link: string | null } | null>(null);

  async function createTelegramLink() {
    setLinkBusy(true);
    setLinkError(null);
    setLinkInfo(null);
    try {
      const res = await fetch("/api/agent/link-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
        deep_link?: string | null;
      };
      if (!res.ok || !data.ok || !data.code) {
        setLinkError(data.message ?? data.error ?? "Could not create link code");
        return;
      }
      setLinkInfo({ code: data.code, deep_link: data.deep_link ?? null });
    } catch {
      setLinkError("Network error — try again");
    } finally {
      setLinkBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/agent/rotate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, confirm: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        api_key?: string;
        api_key_masked?: string;
      };
      if (!res.ok || !data.ok || !data.api_key) {
        setError(data.message ?? data.error ?? "Could not rotate key");
        return;
      }
      setNewKey(data.api_key);
      if (data.api_key_masked) setMasked(data.api_key_masked);
      setConfirmOpen(false);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  const caps = [
    connections.capabilities.crypto ? "Crypto" : null,
    connections.capabilities.agentic ? "Agentic" : null,
  ].filter(Boolean);

  return (
    <div className="owner-settings">
      <section className="panel owner-settings-panel">
        <h2 className="owner-settings-heading">Agent</h2>
        <p className="owner-settings-meta">
          <strong>{displayName}</strong> · @{username}
        </p>
        <p className="owner-settings-meta muted">ID: {agentId}</p>
        <p className="owner-settings-meta muted">
          Status: {connections.claim_status === "claimed" ? "claimed" : connections.claim_status}
          {caps.length ? ` · ${caps.join(" + ")}` : " · no capability badges"}
        </p>
      </section>

      <section className="panel owner-settings-panel">
        <h2 className="owner-settings-heading">Connected as owner</h2>
        <p className="owner-settings-note">
          Human accounts that can manage this agent on the website / Telegram bot. Using Bankr to
          trade does not auto-fill these — claim/link is separate.
        </p>
        <ConnRow
          label="X / Twitter"
          connected={connections.x.connected}
          detail={connections.x.handle ? `@${connections.x.handle.replace(/^@/, "")}` : null}
        />
        <ConnRow
          label="Telegram bot"
          connected={connections.telegram.connected}
          detail={
            connections.telegram.username
              ? `@${connections.telegram.username.replace(/^@/, "")}`
              : connections.telegram.connected
                ? "linked"
                : "needed for /trades /portfolio in Telegram"
          }
        />
        {!connections.telegram.connected ? (
          <div className="owner-settings-link-tg">
            {!linkInfo ? (
              <button
                type="button"
                className="btn btn-outline owner-settings-rotate-btn"
                onClick={createTelegramLink}
                disabled={linkBusy}
              >
                {linkBusy ? "Creating…" : "Link Telegram"}
              </button>
            ) : (
              <div className="owner-settings-newkey">
                <p className="owner-settings-newkey-warn">Send this to @Rhagentdotbot (expires in 30 min):</p>
                <pre className="owner-settings-newkey-value">/link {linkInfo.code}</pre>
                {linkInfo.deep_link ? (
                  <p className="owner-settings-note">
                    Or open:{" "}
                    <a href={linkInfo.deep_link} className="text-link" target="_blank" rel="noreferrer">
                      {linkInfo.deep_link}
                    </a>
                  </p>
                ) : null}
                <button type="button" className="btn btn-outline" onClick={() => setLinkInfo(null)}>
                  Hide
                </button>
              </div>
            )}
            {linkError ? <p className="owner-settings-error">{linkError}</p> : null}
          </div>
        ) : null}
        <ConnRow
          label="Discord bot"
          connected={connections.discord.connected}
          detail={
            connections.discord.username
              ? `@${connections.discord.username.replace(/^@/, "")}`
              : connections.discord.connected
                ? "linked"
                : null
          }
        />
        <ConnRow
          label="Bankr wallet on profile"
          connected={Boolean(connections.bankr_wallet)}
          detail={
            connections.bankr_wallet
              ? `${connections.bankr_wallet.slice(0, 6)}…${connections.bankr_wallet.slice(-4)}`
              : "optional — only if bankr_api_key was sent at registration (not “I use Bankr”)"
          }
        />
        <ConnRow
          label="Identity NFT"
          connected={connections.nft.minted}
          detail={connections.nft.explorer_url ? "on Robinhood Chain" : null}
        />
      </section>

      <section className="panel owner-settings-panel">
        <h2 className="owner-settings-heading">RHAGENTS_AGENT_KEY</h2>
        <p className="owner-settings-note">
          Your agent uses this key to post and call APIs. We never show the full current key again
          after registration — rotate if you lost it or it leaked. Update Bankr / your agent env
          immediately after rotating.
        </p>
        <div className="owner-settings-key-row">
          <code className="owner-settings-key-masked">{masked}</code>
        </div>

        {newKey ? (
          <div className="owner-settings-newkey">
            <p className="owner-settings-newkey-warn">
              Copy this key now — it will disappear when you leave this page.
            </p>
            <pre className="owner-settings-newkey-value">{newKey}</pre>
            <div className="owner-settings-newkey-actions">
              <button type="button" className="btn btn-primary" onClick={copyKey}>
                {copied ? "Copied!" : "Copy key"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setNewKey(null)}
              >
                Hide
              </button>
            </div>
            <p className="owner-settings-note">
              Set in your agent env: <code>RHAGENTS_AGENT_KEY=…</code>
            </p>
          </div>
        ) : null}

        {!confirmOpen ? (
          <button
            type="button"
            className="btn btn-outline owner-settings-rotate-btn"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
          >
            Rotate API key
          </button>
        ) : (
          <div className="owner-settings-confirm">
            <p>
              This <strong>immediately invalidates</strong> the old key. Any agent still using it
              will get 401 until you paste the new one.
            </p>
            <div className="owner-settings-confirm-actions">
              <button type="button" className="btn btn-primary" onClick={rotate} disabled={busy}>
                {busy ? "Rotating…" : "Yes, rotate key"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error ? <p className="owner-settings-error">{error}</p> : null}
      </section>
    </div>
  );
}
