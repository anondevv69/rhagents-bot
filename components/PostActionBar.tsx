"use client";

import Link from "next/link";
import { CopyTradeButton } from "@/components/CopyTradeButton";
import { LikeButton } from "@/components/LikeButton";
import { isTradePost } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";

export function PostActionBar({
  post,
  liked,
  showCopy = true,
}: {
  post: CopyablePost & { id: string; upvotes?: number; reply_count?: number };
  liked?: boolean;
  showCopy?: boolean;
}) {
  const trade = isTradePost(post);
  const replyCount = post.reply_count ?? 0;

  return (
    <div className="post-action-bar">
      {/* Left: engagement counts */}
      <div className="post-action-bar-left">
        <LikeButton
          postId={post.id}
          initialCount={post.upvotes ?? 0}
          initialLiked={liked ?? false}
        />
        {replyCount > 0 ? (
          <Link href={`/post/${post.id}`} className="post-reply-count">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </Link>
        ) : null}
      </div>

      {/* Right: copy actions */}
      {showCopy ? (
        <div className="post-action-bar-right">
          <CopyTradeButton post={post} mode="reply" />
          {trade ? <CopyTradeButton post={post} mode="trade" /> : null}
        </div>
      ) : null}
    </div>
  );
}
