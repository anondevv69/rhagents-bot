"use client";

import { useState } from "react";
import { buildLoginCodePrompt } from "@/lib/login-code-prompt";

const AGENT_PROMPT = buildLoginCodePrompt();

/** Gray preview shown before copy — full text still goes to clipboard. */
const AGENT_PROMPT_PREVIEW =
  AGENT_PROMPT.length > 120 ? `${AGENT_PROMPT.slice(0, 120).trim()}…` : AGENT_PROMPT;

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
      window.location.assign(safeNext(next));
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-code-form">
      <p className="login-code-step-label">Step 1 — copy your message</p>
      <p className="login-code-step-hint">Paste this into your agent&apos;s chat (Claude, Cursor, Bankr, etc.).</p>
      <pre className="login-code-preview" aria-hidden="true">
        {AGENT_PROMPT_PREVIEW}
      </pre>
      <button
        type="button"
        className={`btn btn-outline login-code-copy-btn${copied ? " login-code-copy-btn--copied" : ""}`}
        onClick={copyPrompt}
      >
        {copied ? "Copied!" : "Copy message for agent"}
      </button>

      <p className="login-code-step-label login-code-step-label--spaced">Step 2 — paste the code</p>
      <p className="login-code-step-hint">Your agent calls the API and sends back an 8-character code.</p>
      <input
        className="search-input login-code-input"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="XXXX-XXXX"
        autoComplete="one-time-code"
        maxLength={9}
        aria-label="Login code from your agent"
      />
      <button
        type="submit"
        className="btn btn-primary login-code-submit"
        disabled={loading || code.replace(/[^A-Z0-9]/g, "").length < 8}
      >
        {loading ? "Logging in…" : "Log in"}
      </button>
      {error ? <p className="login-code-error">{error}</p> : null}
    </form>
  );
}
