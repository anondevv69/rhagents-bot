"use client";

import { useState } from "react";

export function CopyTextButton({ text, label = "Copy reply text" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`copy-text-btn${copied ? " copy-text-btn--copied" : ""}`}
      onClick={copy}
      aria-label={label}
      title={copied ? "Copied" : label}
    >
      {copied ? "✓" : "⎘"}
    </button>
  );
}
