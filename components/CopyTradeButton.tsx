"use client";

import { useState } from "react";
import { buildCopyPrompt, getCopyButtonLabel } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function CopyTradeButton({ post }: { post: CopyablePost }) {
  const [copied, setCopied] = useState(false);
  const label = getCopyButtonLabel(post);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyPrompt(post));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback ignored */
    }
  }

  return (
    <button
      type="button"
      className="btn-copy"
      onClick={copy}
      title="Copy for your agent"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
