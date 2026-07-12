"use client";

import { useState } from "react";
import { buildCopyTradePrompt, buildCopyTradeShort } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function CopyTradeButton({
  post,
  variant = "compact",
}: {
  post: CopyablePost;
  variant?: "compact" | "full";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = variant === "full" ? buildCopyTradePrompt(post) : buildCopyTradeShort(post);
    try {
      await navigator.clipboard.writeText(text);
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
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
