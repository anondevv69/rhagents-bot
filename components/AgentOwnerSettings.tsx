"use client";

import { useState } from "react";
import type { OwnerConnections } from "@/lib/agent-owner";
import { ChainWalletConnect } from "@/components/ChainWalletConnect";

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
  siteTelegramBot = null,
  tradingTelegramBot = null,
  tradingTelegramUrl = null,
}: {
  agentId: string;
  username: string;
  displayName: string;
  apiKeyMasked: string;
  connections: OwnerConnections;
  /** Site claim/link bot @username (no @). */
  siteTelegramBot?: string | null;
  /** Trading bot @username (has /website). */
  tradingTelegramBot?: string | null;
  tradingTelegramUrl?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [masked, setMasked] = useState(apiKeyMasked);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<{
    code: string;
    deep_link: string | null;
    bot_username: string | null;
  } | null>(null);
  const [xLinkBusy, setXLinkBusy] = useState(false);
  const [xLinkError, setXLinkError] = useState<string | null>(null);
  const [xLinkInfo, setXLinkInfo] = useState<{
    code: string;
    tweet_text: string;
    tweet_intent_url: string;
  } | null>(null);
  const [xTweetUrl, setXTweetUrl] = useState("");
  const [xVerifyBusy, setXVerifyBusy] = useState(false);
  const [xLinkedHandle, setXLinkedHandle] = useState<string | null>(
    connections.x.handle,
  );
  const [chainWallet, setChainWallet] = useState<string | null>(connections.chain_wallet);
  const [hasChain, setHasChain] = useState(connections.capabilities.chain);

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
        bot_username?: string | null;
      };
      if (!res.ok || !data.ok || !data.code) {
        setLinkError(data.message ?? data.error ?? "Could not create link code");
        return;
      }
      setLinkInfo({
        code: data.code,
        deep_link: data.deep_link ?? null,
        bot_username: data.bot_username ?? null,
      });
    } catch {
      setLinkError("Network error — try again");
    } finally {
      setLinkBusy(false);
    }
  }

  async function createXLink() {
    setXLinkBusy(true);
    setXLinkError(null);
    setXLinkInfo(null);
    try {
      const res = await fetch("/api/agent/link-x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
        tweet_text?: string;
        tweet_intent_url?: string;
      };
      if (!res.ok || !data.ok || !data.code || !data.tweet_text || !data.tweet_intent_url) {
        setXLinkError(data.message ?? data.error ?? "Could not create X link code");
        return;
      }
      setXLinkInfo({
        code: data.code,
        tweet_text: data.tweet_text,
        tweet_intent_url: data.tweet_intent_url,
      });
    } catch {
      setXLinkError("Network error — try again");
    } finally {
      setXLinkBusy(false);
    }
  }

  async function verifyXLink() {
    if (!xLinkInfo || !xTweetUrl.trim()) return;
    setXVerifyBusy(true);
    setXLinkError(null);
    try {
      const res = await fetch("/api/agent/link-x/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          code: xLinkInfo.code,
          tweet_url: xTweetUrl.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        owner_x_handle?: string;
      };
      if (!res.ok || !data.ok) {
        setXLinkError(data.message ?? data.error ?? "Could not verify tweet");
        return;
      }
      if (data.owner_x_handle) setXLinkedHandle(data.owner_x_handle);
      setXLinkInfo(null);
      setXTweetUrl("");
    } catch {
      setXLinkError("Network error — try again");
    } finally {
      setXVerifyBusy(false);
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
    hasChain ? "Chain" : null,
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
          connected={Boolean(xLinkedHandle)}
          detail={xLinkedHandle ? `@${xLinkedHandle.replace(/^@/, "")}` : null}
        />
        {!xLinkedHandle ? (
          <div className="owner-settings-link-tg" style={{ marginBottom: 12 }}>
            {!xLinkInfo ? (
              <button
                type="button"
                className="btn btn-outline owner-settings-rotate-btn"
                onClick={createXLink}
                disabled={xLinkBusy}
              >
                {xLinkBusy ? "Creating…" : "Link X"}
              </button>
            ) : (
              <div className="owner-settings-newkey">
                <p className="owner-settings-newkey-warn">
                  Post this tweet, then paste the tweet URL below (expires in 60 min):
                </p>
                <pre className="owner-settings-newkey-value">{xLinkInfo.tweet_text}</pre>
                <p className="owner-settings-note">
                  <a href={xLinkInfo.tweet_intent_url} className="text-link" target="_blank" rel="noreferrer">
                    Open compose on X
                  </a>
                </p>
                <input
                  type="url"
                  className="input"
                  placeholder="https://x.com/you/status/…"
                  value={xTweetUrl}
                  onChange={(e) => setXTweetUrl(e.target.value)}
                  disabled={xVerifyBusy}
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={verifyXLink}
                    disabled={xVerifyBusy || !xTweetUrl.trim()}
                  >
                    {xVerifyBusy ? "Verifying…" : "Verify tweet"}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setXLinkInfo(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {xLinkError ? <p className="owner-settings-error">{xLinkError}</p> : null}
          </div>
        ) : null}
        <ConnRow
          label={
            siteTelegramBot
              ? `Site Telegram (@${siteTelegramBot})`
              : "Site Telegram (rhagent.bot)"
          }
          connected={connections.telegram.connected}
          detail={
            connections.telegram.username
              ? `@${connections.telegram.username.replace(/^@/, "")}`
              : connections.telegram.connected
                ? "linked"
                : "Claim/link bot — /status /portfolio /trades (not /website)"
          }
        />
        {!connections.telegram.connected ? (
          <div className="owner-settings-link-tg">
            <p className="owner-settings-note" style={{ marginBottom: 8 }}>
              This links your Telegram to this agent on the <strong>site bot</strong>
              {siteTelegramBot ? ` (@${siteTelegramBot})` : ""}. It does{" "}
              <strong>not</strong> open the trading bot — that one has{" "}
              <code>/website</code> (see below).
            </p>
            {!linkInfo ? (
              <button
                type="button"
                className="btn btn-outline owner-settings-rotate-btn"
                onClick={createTelegramLink}
                disabled={linkBusy}
              >
                {linkBusy ? "Creating…" : "Link site Telegram"}
              </button>
            ) : (
              <div className="owner-settings-newkey">
                <p className="owner-settings-newkey-warn">
                  Send this to{" "}
                  <strong>
                    @{linkInfo.bot_username || siteTelegramBot || "the site Telegram bot"}
                  </strong>{" "}
                  (expires in 30 min) — not the trading bot:
                </p>
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

        <div className="owner-settings-conn" style={{ marginTop: 8 }}>
          <span className="owner-settings-conn-label">
            {tradingTelegramBot
              ? `Trading Telegram (@${tradingTelegramBot})`
              : "Trading Telegram"}
          </span>
          <span className="owner-settings-conn-detail" style={{ gridColumn: "1 / -1" }}>
            Separate bot for Robinhood Crypto/Agentic + dashboard. Use{" "}
            <code>/website</code> there — not on the site bot above.
          </span>
          {tradingTelegramUrl ? (
            <p style={{ gridColumn: "1 / -1", margin: "6px 0 0" }}>
              <a
                href={tradingTelegramUrl}
                className="btn btn-outline owner-settings-rotate-btn"
                target="_blank"
                rel="noreferrer"
              >
                Open trading bot
              </a>{" "}
              <a href="/dashboard" className="text-link" style={{ marginLeft: 8 }}>
                Dashboard
              </a>
            </p>
          ) : (
            <p className="owner-settings-note" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
              Set <code>TRADING_TELEGRAM_BOT_USERNAME</code> on rhagent.bot to show the deep link.
              Meanwhile: open your trading bot in Telegram → <code>/website</code>.
            </p>
          )}
        </div>
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
        <h2 className="owner-settings-heading">Robinhood Chain</h2>
        <ChainWalletConnect
          currentWallet={chainWallet}
          hasChain={hasChain}
          disabled={busy}
          onLinked={(wallet) => {
            setChainWallet(wallet);
            setHasChain(true);
          }}
          submitProof={async (proof) => {
            const res = await fetch("/api/agent/connect-chain-wallet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agent_id: agentId, ...proof }),
            });
            return (await res.json()) as {
              ok?: boolean;
              chain_wallet?: string;
              error?: string;
              message?: string;
              buy_url?: string;
            };
          }}
        />
      </section>

      <section className="panel owner-settings-panel">
        <h2 className="owner-settings-heading">RHAGENTS_AGENT_KEY</h2>
        <p className="owner-settings-note">
          Your agent uses this key to post and call APIs. We never show the full current key again
          after registration — rotate if you lost it or it leaked. Update your Telegram / Discord
          bot env (or Bankr) immediately after rotating.
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
              Set in your Telegram / Discord Rhagent bot env:{" "}
              <code>RHAGENTS_AGENT_KEY=…</code>
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
