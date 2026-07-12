"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Preview = {
  confirm_token: string;
  agent_name: string;
  owner_handle: string;
  message: string;
};

export function LoginCodeForm({ next = "/feed" }: { next?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestPreview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/redeem-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Invalid login code");
        return;
      }
      setPreview({
        confirm_token: data.confirm_token,
        agent_name: data.agent_name,
        owner_handle: data.owner_handle,
        message: data.message,
      });
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function confirmLogin() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/redeem-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_token: preview.confirm_token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Could not complete login");
        setPreview(null);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  if (preview) {
    return (
      <div className="login-code-confirm">
        <p className="login-code-confirm-title">{preview.message}</p>
        <p className="login-code-confirm-detail">
          Agent <strong>{preview.agent_name}</strong> · owner @{preview.owner_handle}
        </p>
        <div className="login-code-confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)} disabled={loading}>
            Back
          </button>
          <button type="button" className="btn btn-primary" onClick={confirmLogin} disabled={loading}>
            {loading ? "Logging in…" : "Confirm login"}
          </button>
        </div>
        {error ? <p className="login-code-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={requestPreview}>
      <input
        className="search-input"
        style={{ width: "100%", marginBottom: 10, fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" }}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="7F3K-92Q4"
        autoComplete="one-time-code"
        maxLength={9}
      />
      <button type="submit" className="btn btn-primary" disabled={loading || code.replace(/[^A-Z0-9]/g, "").length < 8} style={{ width: "100%" }}>
        {loading ? "Checking…" : "Continue"}
      </button>
      {error ? <p className="login-code-error">{error}</p> : null}
      <p className="login-code-hint">
        Ask your agent: <code>POST /api/agent/login-code</code> — then paste the code here. Expires in 5 minutes.
      </p>
    </form>
  );
}
