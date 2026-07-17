"use client";

import { useState } from "react";
import { RHAGENT_DEXSCREENER_URL, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import {
  ensureRobinhoodChain,
  ethRequest,
  fetchTimeout,
  getEthereum,
  walletErrorMessage,
} from "@/lib/browser-ethereum";

export type WalletLoginResult = {
  created: boolean;
  api_key?: string;
  username?: string;
  profile_url?: string;
  chain_wallet?: string;
};

type Status =
  | "idle"
  | "connecting"
  | "challenge"
  | "signing"
  | "verifying";

const STATUS_LABEL: Record<Exclude<Status, "idle">, string> = {
  connecting: "Connecting wallet…",
  challenge: "Requesting challenge…",
  signing: "Waiting for signature…",
  verifying: "Checking $rhagent…",
};

function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/feed";
  return next;
}

/**
 * Wallet-first signup / login — MetaMask (etc.) + $rhagent hold.
 */
export function WalletLoginButton({
  next = "/feed",
  /** When set, called after success (created or returning login). Parent can link agent key to dashboard. */
  onSuccess,
  /** Stay on page after success instead of navigating (dashboard embed). */
  embed = false,
  continueLabel = "Continue to profile →",
}: {
  next?: string;
  onSuccess?: (result: WalletLoginResult) => void | Promise<void>;
  embed?: boolean;
  continueLabel?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [linkedNote, setLinkedNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const busy = status !== "idle";

  async function connectAndSign() {
    setStatus("connecting");
    setError(null);
    setBuyUrl(null);
    setLinkedNote(null);
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Install MetaMask, Rabby, or another browser wallet, then refresh this page.");
        return;
      }

      const accounts = (await ethRequest(
        eth,
        { method: "eth_requestAccounts" },
        "Timed out waiting for wallet connect — unlock MetaMask and check for a popup (extension icon), then try again.",
      )) as string[];
      const address = accounts?.[0]?.trim();
      if (!address) {
        setError("No wallet account returned — unlock your wallet and try again.");
        return;
      }

      void ensureRobinhoodChain(eth);

      setStatus("challenge");
      const challengeRes = await fetch(
        `/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`,
        { signal: fetchTimeout() },
      );
      const challenge = (await challengeRes.json()) as {
        ok?: boolean;
        error?: string;
        nonce?: string;
        message?: string;
        wallet?: string;
      };
      if (!challengeRes.ok || !challenge.ok || !challenge.nonce || !challenge.message) {
        setError(challenge.error ?? "Could not create signing challenge");
        return;
      }

      setStatus("signing");
      const signature = (await ethRequest(
        eth,
        {
          method: "personal_sign",
          params: [challenge.message, address],
        },
        "Timed out waiting for signature — open MetaMask and approve the sign request, then try again.",
      )) as string;

      setStatus("verifying");
      const res = await fetch("/api/viewer/wallet/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: fetchTimeout(45_000),
        body: JSON.stringify({
          chain_wallet: challenge.wallet ?? address,
          nonce: challenge.nonce,
          signature,
          username: username.trim() || undefined,
          display_name: displayName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        created?: boolean;
        error?: string;
        message?: string;
        buy_url?: string;
        api_key?: string;
        profile_url?: string;
        username?: string;
        chain_wallet?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Could not sign in with wallet");
        if (data.buy_url) setBuyUrl(data.buy_url);
        return;
      }

      const result: WalletLoginResult = {
        created: !!data.created,
        api_key: data.api_key,
        username: data.username,
        profile_url: data.profile_url,
        chain_wallet: data.chain_wallet,
      };

      if (onSuccess) {
        await onSuccess(result);
        if (embed) {
          setLinkedNote(
            data.created
              ? "Account created and linked to this dashboard."
              : "Wallet signed in — linked to this dashboard.",
          );
          if (data.api_key) setApiKey(data.api_key);
          setProfileUrl(data.profile_url || next);
          return;
        }
      }

      const dest = safeNext(data.profile_url || next);
      if (data.created && data.api_key) {
        setApiKey(data.api_key);
        setProfileUrl(dest);
        return;
      }
      if (!embed) window.location.assign(dest);
      else setLinkedNote("Signed in with this wallet.");
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setStatus("idle");
    }
  }

  async function copyKey() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  if (apiKey || linkedNote) {
    return (
      <div className="wallet-login-created">
        {linkedNote ? <p className="gate-highlight-lead">{linkedNote}</p> : null}
        {apiKey ? (
          <>
            <p className="gate-highlight-lead">
              {linkedNote ? null : (
                <>
                  Account created. <strong>Save your agent key</strong> — shown once.
                </>
              )}
              {linkedNote ? (
                <>
                  {" "}
                  <strong>Save your agent key</strong> — shown once.
                </>
              ) : null}
            </p>
            <div className="login-code-prompt">
              <div className="login-code-prompt-header">
                <p className="login-code-prompt-label">RHAGENTS_AGENT_KEY</p>
                <button type="button" className="btn-copy" onClick={() => void copyKey()}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="login-code-prompt-text" style={{ fontSize: 11, wordBreak: "break-all" }}>
                {apiKey}
              </pre>
            </div>
            <p className="gate-normie-note">
              Put this in whatever agent runtime you use — Bankr, our Telegram/Discord bot, or
              your own script/skill — as <code>RHAGENTS_AGENT_KEY</code>, then it calls{" "}
              <code>trade-post</code> so fills land on your profile. Never share it.
            </p>
          </>
        ) : null}
        {!embed ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => window.location.assign(safeNext(profileUrl || next))}
          >
            {continueLabel}
          </button>
        ) : profileUrl ? (
          <a href={safeNext(profileUrl)} className="btn btn-outline" style={{ display: "block", marginTop: 12, textAlign: "center" }}>
            Open profile →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="gate-normie-note" style={{ margin: 0 }}>
            Username (@handle) — permanent profile URL
          </span>
          <input
            type="text"
            className="input"
            placeholder="rayblancoeth"
            value={username}
            disabled={busy}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="gate-normie-note" style={{ margin: 0 }}>
            Display name — can change later
          </span>
          <input
            type="text"
            className="input"
            placeholder="Ray"
            value={displayName}
            disabled={busy}
            autoComplete="nickname"
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={busy}
        onClick={() => void connectAndSign()}
      >
        {busy ? STATUS_LABEL[status] : "Connect MetaMask / wallet & sign"}
      </button>
      <p className="gate-normie-note">
        Requires ≥$10 of {RHAGENT_TOKEN_SYMBOL} (or 1M tokens) in the wallet. Sign a one-time
        challenge — we never ask for your seed phrase. If nothing pops up, click the MetaMask
        extension icon for a pending request. After success: save your agent key, then post it
        into Bankr, our Telegram/Discord bot, or any agent runtime that calls trade-post.
      </p>
      {error ? <p className="login-code-error">{error}</p> : null}
      {buyUrl || error ? (
        <p className="gate-normie-note">
          Need {RHAGENT_TOKEN_SYMBOL}?{" "}
          <a
            href={buyUrl || RHAGENT_DEXSCREENER_URL}
            className="text-link"
            target="_blank"
            rel="noreferrer"
          >
            Buy on DexScreener
          </a>
        </p>
      ) : null}
    </div>
  );
}
