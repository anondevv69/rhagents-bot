"use client";

import { useState } from "react";
import { PhosphorCopyIcon } from "@/components/icons/PhosphorCopyIcon";
import { buildCopyPostReference } from "@/lib/copy-trade";

import { ATLAS_BTN_GHOST } from "@/lib/atlas-classes";

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
      className={`${ATLAS_BTN_GHOST} atlas-btn-icon${copied ? " atlas-badge atlas-badge-bullish" : ""}`}
      onClick={copy}
      aria-label={copied ? "Copied post URL" : "Copy post URL"}
      title={copied ? "Copied" : "Copy post"}
    >
      {copied ? "Copied" : <PhosphorCopyIcon size={15} />}
    </button>
  );
}
