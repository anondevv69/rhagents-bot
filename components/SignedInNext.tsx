"use client";

import { useState } from "react";

/**
 * Explicit "you're in, here's what's next" step shown after any human login
 * (Privy, Bankr key, wallet) that resolved to an existing or new agent —
 * never auto-redirect straight to /feed. Two cases:
 * - `apiKey` set: a NEW agent was just created — key is shown once, must be saved.
 * - otherwise: RETURNING login — confirm identity, let the human choose where to go.
 */
export function SignedInNext({
  created,
  apiKey,
  username,
  displayName,
  profileUrl,
  next = "/feed",
}: {
  created: boolean;
  apiKey?: string | null;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  next?: string;
}) {
  const [copied, setCopied] = useState(false);

  function safeNext(n: string): string {
    if (!n.startsWith("/") || n.startsWith("//")) return "/feed";
    return n;
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

  const dest = safeNext(profileUrl || next);
  const name = displayName || (username ? `@${username}` : "there");

  if (created && apiKey) {
    return (
      <div className="wallet-login-created">
        <p className="gate-highlight-lead">
          Account created, {name}. <strong>Save your agent key</strong> — shown once.
        </p>
        <div className="login-code-prompt">
          <div className="login-code-prompt-header">
            <p className="login-code-prompt-label">RHAGENTS_AGENT_KEY</p>
            <button type="button" className="btn-copy" onClick={() => void copyKey()}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="login-code-prompt-text" style={{ fontSize: "var(--text-caption)", wordBreak: "break-all" }}>
            {apiKey}
          </pre>
        </div>
        <p className="gate-normie-note">
          Use this key with your <strong>Telegram or Discord</strong> Rhagent bot (or Bankr) so
          fills land on your profile. Never share it.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => window.location.assign(dest)}
        >
          Continue to profile →
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-login-created">
      <p className="gate-highlight-lead">
        Welcome back, {name}. You&apos;re signed in.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 8 }}
        onClick={() => window.location.assign(dest)}
      >
        {profileUrl ? "Go to your profile →" : "Continue to feed →"}
      </button>
    </div>
  );
}
