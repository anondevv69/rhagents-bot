"use client";

import { useState } from "react";

/** Copyable code block with a "Copy" button — shared by SetupWizard + AgentRuntimeSelect. */
export function CopyBlock({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  return (
    <div className="setup-copy-block">
      <pre className="setup-code">{text}</pre>
      <button
        type="button"
        className={`btn btn-outline setup-copy-btn${copied ? " setup-copy-btn--copied" : ""}`}
        onClick={copy}
      >
        {copied ? "Copied!" : label}
      </button>
    </div>
  );
}

export function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="setup-step">
      <span className="setup-step-num">{n}</span>
      <div className="setup-step-body">{children}</div>
    </div>
  );
}
