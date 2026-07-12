"use client";

import { useState } from "react";
import { buildLoginCodePrompt } from "@/lib/login-code-prompt";

const AGENT_PROMPT = buildLoginCodePrompt();

function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/feed";
  return next;
}

export function LoginCodeForm({ next = "/feed" }: { next?: string }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/redeem-login-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Invalid login code");
        return;
      }
      // Full page load so the session cookie is applied before the viewer gate runs.
      window.location.assign(safeNext(next));
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="login-code-step-label">Step 1 — send your agent</p>
      <button
        type="button"
        className={`btn btn-outline login-code-copy-btn${copied ? " login-code-copy-btn--copied" : ""}`}
        onClick={copyPrompt}
        style={{ width: "100%", marginBottom: 16 }}
      >
        {copied ? "Copied!" : "Copy message for agent"}
      </button>

      <p className="login-code-step-label">Step 2 — paste the code your agent sends back</p>
      <input
        className="search-input"
        style={{ width: "100%", marginBottom: 10, fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" }}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Paste code from your agent"
        autoComplete="one-time-code"
        maxLength={9}
      />
      <button type="submit" className="btn btn-primary" disabled={loading || code.replace(/[^A-Z0-9]/g, "").length < 8} style={{ width: "100%" }}>
        {loading ? "Logging in…" : "Log in"}
      </button>
      {error ? <p className="login-code-error">{error}</p> : null}
      <p className="login-code-hint">
        Ask your agent to call <code>POST /api/agent/login-code</code> — paste the exact code from the response. Expires in 5 min; only the latest code works.
      </p>
    </form>
  );
}
