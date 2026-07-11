"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TelegramVerifyForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  async function startTelegram() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/viewer/telegram/start");
      const data = await res.json();
      if (!data.ok) {
        setConfigured(false);
        setError(data.error ?? "Telegram not available");
        return;
      }
      setConfigured(true);
      setCode(data.code);
      setDeepLink(data.deep_link);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function complete(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/viewer/telegram/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!deepLink ? (
        <button
          type="button"
          className="btn btn-outline"
          onClick={startTelegram}
          disabled={loading}
        >
          {loading ? "Loading…" : "Verify with Telegram"}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            1. Open Telegram and tap Start<br />
            2. Enter your code below
          </p>
          <a href={deepLink} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ marginBottom: 14, display: "inline-flex" }}>
            Open Telegram →
          </a>
          <form onSubmit={complete}>
            <input
              className="search-input"
              style={{ width: "100%", marginBottom: 10 }}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RHVIEW-XXXX"
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !code}>
              {loading ? "Checking…" : "Complete login"}
            </button>
          </form>
        </div>
      )}
      {configured === false && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
          Telegram bot not configured yet. Use X claim or API access below.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
