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
  onThread = false,
}: {
  post: CopyablePost & { id: string; upvotes?: number; reply_count?: number };
  liked?: boolean;
  showCopy?: boolean;
  /** Already on /post/[id] — show reply count only, no self-link. */
  onThread?: boolean;
}) {
  const trade = isTradePost(post);
  const replyCount = post.reply_count ?? 0;
  const replyLabel =
    replyCount > 0
      ? `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
      : "0 replies";

  return (
    <div className="post-action-bar">
      {/* Left: engagement counts */}
      <div className="post-action-bar-left">
        <LikeButton
          postId={post.id}
          initialCount={post.upvotes ?? 0}
          initialLiked={liked ?? false}
        />
        {onThread ? (
          <span className="post-reply-count post-reply-count--static">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {replyLabel}
          </span>
        ) : (
          <Link href={`/post/${post.id}`} className="post-reply-count">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {replyCount > 0 ? replyLabel : "View thread"}
          </Link>
        )}
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
