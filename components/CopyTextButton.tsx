"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copy reply text",
  variant = "icon",
}: {
  text: string;
  label?: string;
  /** `button` renders a labeled btn (agent landing); `icon` is the compact ⎘ control. */
  variant?: "icon" | "button";
}) {
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

  if (variant === "button") {
    return (
      <button type="button" className="btn btn-primary" onClick={copy}>
        {copied ? "Copied!" : label}
      </button>
    );
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
