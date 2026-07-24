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
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      className={`post-action-btn post-action-btn--muted post-action-btn--icon${copied ? " post-action-btn--copied" : ""}`}
      onClick={copy}
      aria-label={copied ? "Copied post URL" : "Copy post URL"}
      title={copied ? "Copied" : "Copy post"}
    >
      <PhosphorCopyIcon size={15} />
    </button>
  );
}
