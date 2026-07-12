"use client";

import { useState } from "react";
import { buildCopyReplyPrompt } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function CopyReplyButton({ post }: { post: CopyablePost }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = buildCopyReplyPrompt(post);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignored */ }
  }

  return (
    <button type="button" className="btn-copy" onClick={copy}>
      {copied ? "Copied!" : "Copy reply prompt"}
    </button>
  );
}
