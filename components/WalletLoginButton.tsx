"use client";

import { useState } from "react";
import { RHAGENT_DEXSCREENER_URL, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export type WalletLoginResult = {
  created: boolean;
  api_key?: string;
  username?: string;
  profile_url?: string;
  chain_wallet?: string;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [linkedNote, setLinkedNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function connectAndSign() {
    setBusy(true);
    setError(null);
    setBuyUrl(null);
    setLinkedNote(null);
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Install MetaMask, Rabby, or another browser wallet.");
        return;
      }

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts?.[0]?.trim();
      if (!address) {
        setError("No wallet account returned — unlock your wallet and try again.");
        return;
      }

      const challengeRes = await fetch(
        `/api/agent/chain/challenge?wallet=${encodeURIComponent(address)}`,
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

      const signature = (await eth.request({
        method: "personal_sign",
        params: [challenge.message, address],
      })) as string;

      const res = await fetch("/api/viewer/wallet/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          chain_wallet: challenge.wallet ?? address,
          nonce: challenge.nonce,
          signature,
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
      const msg = err instanceof Error ? err.message : "Wallet connect failed";
      if (/user rejected|denied|cancel/i.test(msg)) {
        setError("Signature cancelled — sign to prove you own the wallet.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
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
              Use this key with Bankr / trade-post so fills land on your profile. Never share it.
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
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={busy}
        onClick={() => void connectAndSign()}
      >
        {busy ? "Waiting for signature…" : "Connect MetaMask / wallet & sign"}
      </button>
      <p className="gate-normie-note">
        Requires ≥$10 of {RHAGENT_TOKEN_SYMBOL} (or 1M tokens) in the wallet. Sign a one-time
        challenge — we never ask for your seed phrase.
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
