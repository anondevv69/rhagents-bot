"use client";

import { useState } from "react";
import { buildCopyReference, getCopyButtonLabel, type CopyMode } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CopyTradeButton({
  post,
  mode,
}: {
  post: CopyablePost;
  mode: CopyMode;
}) {
  const [copied, setCopied] = useState(false);
  const label = getCopyButtonLabel(mode);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyReference(post, mode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  return (
    <button
      type="button"
      className={`btn-copy btn-copy--${mode}${copied ? " btn-copy--copied" : ""}`}
      onClick={copy}
      title="Copy reference for your agent"
    >
      <CopyIcon />
      {copied ? "Copied!" : label}
    </button>
  );
}
