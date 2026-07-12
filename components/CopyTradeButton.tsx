"use client";

import { useState } from "react";
import { buildCopyReference, getCopyButtonLabel, type CopyMode } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function CopyTradeButton({ post, mode }: { post: CopyablePost; mode: CopyMode }) {
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
      className="btn-copy"
      onClick={copy}
      title="Copy reference for your agent"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
