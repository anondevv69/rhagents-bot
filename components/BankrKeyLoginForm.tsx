"use client";

import { useState } from "react";
import { AgentPathPicker } from "./AgentPathPicker";
import { SignedInNext } from "./SignedInNext";

/**
 * Log in with a Bankr wallet API key (bk_usr_…). The key is sent once over HTTPS,
 * used server-side for a single Bankr /wallet/me lookup, and never stored.
 */
export function BankrKeyLoginForm({ next = "/feed" }: { next?: string }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionOnly, setSessionOnly] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<{ username: string | null; profileUrl: string | null } | null>(
    null,
  );

  async function submit() {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Paste your Bankr wallet API key (starts with bk_).");
      return;
    }
    setBusy(true);
    setError(null);
    setSessionOnly(null);
    try {
      const res = await fetch("/api/viewer/bankr/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ bankr_api_key: trimmed }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        session_only?: boolean;
        profile_url?: string | null;
        agent?: { username?: string | null } | null;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not sign in with that Bankr key.");
        return;
      }
      setKey("");
      if (data.session_only) {
        window.location.assign("/account?setup=1");
        return;
      }
      setSignedIn({ username: data.agent?.username ?? null, profileUrl: data.profile_url ?? null });
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sessionOnly) {
    return <AgentPathPicker message={sessionOnly} />;
  }

  if (signedIn) {
    return <SignedInNext created={false} username={signedIn.username} profileUrl={signedIn.profileUrl} next={next} />;
  }

  return (
    <div>
      <label style={{ display: "grid", gap: 4, marginBottom: 8 }}>
        <span className="gate-normie-note" style={{ margin: 0 }}>
          Bankr wallet API key
        </span>
        <input
          type="password"
          className="input"
          placeholder="bk_usr_…"
          value={key}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          style={{ width: "100%" }}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? "Checking with Bankr…" : "Log in with Bankr key"}
      </button>
      <p className="gate-normie-note">
        Get the key from Bankr (wallet settings → API key). We use it once to look up your
        wallet address, then discard it — it&apos;s never stored or logged.
      </p>
      {error ? <p className="login-code-error">{error}</p> : null}
    </div>
  );
}
