"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrivyAddFundsButton } from "@/components/PrivyAddFundsButton";

interface ClubStatus {
  member: boolean | null;
  status: string | null;
  expires_at: string | null;
}

interface ProStatus {
  ok: boolean;
  has_agent?: boolean;
  agent_username?: string | null;
  has_bankr_wallet?: boolean;
  bankr_wallet?: string | null;
  provisioned?: boolean;
  needs_key?: boolean;
  club?: ClubStatus | null;
  base_usdc?: number | null;
  price_usd?: number;
  funded?: boolean | null;
}

/**
 * rhagent Pro — $20/mo membership on the managed wallet (whitelabeled Bankr Club).
 * Deposit $20 USDC on Base into the managed wallet via Privy, then activate.
 * Unlocks automations, hosted env storage, and 1,000 agent messages/day.
 */
export function BankrProPanel() {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [pendingPoll, setPendingPoll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKeyInput, setNeedsKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/viewer/bankr/pro/status", { credentials: "same-origin" });
      const data = (await res.json()) as ProStatus;
      if (data.ok) {
        setStatus(data);
        if (data.needs_key) setNeedsKeyInput(true);
        if (data.club?.member === true) setPendingPoll(false);
      }
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pendingPoll) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
      return;
    }
    pollTimer.current = setInterval(() => void refresh(), 8000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [pendingPoll, refresh]);

  async function activate() {
    setError(null);
    setMessage(null);
    setActivating(true);
    try {
      const res = await fetch("/api/viewer/bankr/pro/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(apiKey.trim() ? { bankr_api_key: apiKey.trim() } : {}),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage(data.message ?? null);
        if (data.state === "member") {
          setPendingPoll(false);
        } else {
          setPendingPoll(true);
        }
        void refresh();
      } else if (data.error === "key_required") {
        setNeedsKeyInput(true);
        setError(data.message ?? "Paste your wallet API key to continue.");
      } else if (data.state === "needs_deposit") {
        setError(data.message ?? "Deposit hasn't landed yet — fund the wallet below first.");
        void refresh();
      } else {
        setError(data.message ?? data.error ?? "Activation failed — try again.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <p className="owner-settings-note">Checking Pro status…</p>;
  }
  if (!status?.has_agent) {
    return (
      <p className="owner-settings-note">
        Pro unlocks automations (DCA, limit, stop), hosted env storage, and 1,000 agent
        messages/day for $20/mo. Connect or create an agent profile first, then come back here.
      </p>
    );
  }

  const member = status.club?.member === true;
  const price = status.price_usd ?? 20;
  const usdc = status.base_usdc;

  if (member) {
    return (
      <div className="bankr-pro-panel">
        <p className="bankr-pro-active">
          ✓ <strong>Pro is active</strong>
          {status.club?.expires_at ? ` — renews ${new Date(status.club.expires_at).toLocaleDateString()}` : ""}.
          Automations, hosted env, and 1,000 messages/day are unlocked in the Telegram/Discord bot
          and web chat.
        </p>
      </div>
    );
  }

  return (
    <div className="bankr-pro-panel">
      <p className="owner-settings-note">
        <strong>rhagent Pro — ${price}/mo.</strong> Unlocks standing automations (DCA, limit,
        stop, TWAP), hosted env storage, and 1,000 agent messages/day. Paid on-chain from your
        managed wallet — no card subscription.
      </p>

      <ol className="bankr-pro-steps">
        <li className={usdc != null && usdc >= price ? "bankr-pro-step-done" : ""}>
          <strong>1. Deposit ${price}</strong> — card or crypto, lands as USDC on Base in your
          managed wallet{usdc != null ? ` (current: $${usdc.toFixed(2)})` : ""}.
        </li>
        <li>
          <strong>2. Activate</strong> — we pay the membership from that USDC and flip on your
          Pro features.
        </li>
      </ol>

      {status.has_bankr_wallet && status.bankr_wallet ? (
        <PrivyAddFundsButton
          destinationAddress={status.bankr_wallet}
          amountUsd={price}
          note={`Deposits go straight to your managed wallet on Base. Once ~$${price} USDC lands, hit Activate Pro.`}
          onFunded={() => void refresh()}
        />
      ) : (
        <p className="owner-settings-note">
          No managed wallet yet — Activate Pro below creates one for you automatically, then
          come back to deposit.
        </p>
      )}

      {needsKeyInput ? (
        <div className="bankr-pro-key-row">
          <input
            type="password"
            className="login-code-input"
            placeholder="bk_usr_… wallet API key (used once, never stored)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
          />
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary"
        disabled={activating || pendingPoll}
        onClick={() => void activate()}
        style={{ marginTop: 10 }}
      >
        {activating
          ? "Activating…"
          : pendingPoll
            ? "Waiting for confirmation…"
            : `Activate Pro — $${price}/mo`}
      </button>

      {message ? <p className="owner-settings-note bankr-pro-message">{message}</p> : null}
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
