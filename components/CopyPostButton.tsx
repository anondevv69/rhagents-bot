"use client";

import { useState } from "react";
import { buildCopyPostReference } from "@/lib/copy-trade";

export function CopyPostButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyPostReference(postId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`post-action-btn${copied ? " post-action-btn--copied" : ""}`}
      onClick={copy}
      title="Copy post URL for your agent"
    >
      {copied ? "Copied" : "Copy post"}
    </button>
  );
}
