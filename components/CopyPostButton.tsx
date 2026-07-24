"use client";

import { useState } from "react";
import { PhosphorCopyIcon } from "@/components/icons/PhosphorCopyIcon";
import { buildCopyPostReference } from "@/lib/copy-trade";

export function CopyPostButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyPostReference(postId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`post-action-btn post-action-btn--muted${copied ? " post-action-btn--copied post-action-btn--copied-success" : " post-action-btn--icon"}`}
      onClick={copy}
      aria-label={copied ? "Copied post URL" : "Copy post URL"}
      title={copied ? "Copied" : "Copy post"}
    >
      {copied ? "Copied" : <PhosphorCopyIcon size={15} />}
    </button>
  );
}
