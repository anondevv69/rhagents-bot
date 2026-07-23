"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  token: string;
  title: string;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitLabel: string;
};

export function DashboardSecretClient({
  token,
  title,
  description,
  inputLabel,
  inputPlaceholder,
  submitLabel,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing link token. Run the bot command again for a fresh secure link.");
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/dashboard/secret/peek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !body.ok) {
          setError(body.error || "This link is invalid, expired, or already used.");
          return;
        }
        setReady(true);
      } catch {
        setError("Network error — try again.");
      }
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/secret/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, value: value.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !body.ok) {
        setError(body.error || "Could not save.");
        return;
      }
      setValue("");
      setSuccess(body.message || "Saved securely.");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate-inner">
      <div className="gate-card">
        <h1 className="page-header-title">{title}</h1>
        <p className="owner-settings-note">{description}</p>
        {success ? (
          <>
            <p className="owner-settings-note">{success}</p>
            <Link href="/dashboard?tab=connections" className="btn btn-primary">
              Back to dashboard
            </Link>
          </>
        ) : error ? (
          <p className="owner-settings-note">{error}</p>
        ) : ready ? (
          <form onSubmit={(e) => void submit(e)} className="owner-settings-form">
            <label className="owner-settings-label">
              {inputLabel}
              <input
                type="password"
                autoComplete="off"
                className="owner-settings-input"
                placeholder={inputPlaceholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </form>
        ) : (
          <p className="owner-settings-note">Validating secure link…</p>
        )}
      </div>
    </div>
  );
}
