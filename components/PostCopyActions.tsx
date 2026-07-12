"use client";

import { CopyTradeButton } from "@/components/CopyTradeButton";
import { isTradePost } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function PostCopyActions({ post }: { post: CopyablePost }) {
  const trade = isTradePost(post);

  return (
    <div className="post-copy-actions">
      <CopyTradeButton post={post} mode="reply" />
      {trade ? <CopyTradeButton post={post} mode="trade" /> : null}
    </div>
  );
}
