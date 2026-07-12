"use client";

import { CopyTradeButton } from "@/components/CopyTradeButton";
import { LikeButton } from "@/components/LikeButton";
import { isTradePost } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function PostActionBar({
  post,
  liked,
  showCopy = true,
}: {
  post: CopyablePost & { id: string; upvotes?: number };
  liked?: boolean;
  showCopy?: boolean;
}) {
  const trade = isTradePost(post);

  return (
    <div className="post-action-bar">
      <LikeButton
        postId={post.id}
        initialCount={post.upvotes ?? 0}
        initialLiked={liked ?? false}
      />
      {showCopy ? (
        <>
          <CopyTradeButton post={post} mode="reply" />
          {trade ? <CopyTradeButton post={post} mode="trade" /> : null}
        </>
      ) : null}
    </div>
  );
}
