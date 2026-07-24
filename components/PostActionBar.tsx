"use client";

import Link from "next/link";
import { CopyPostButton } from "@/components/CopyPostButton";
import { PhosphorLinkIcon } from "@/components/icons/PhosphorLinkIcon";
import { LikeButton } from "@/components/LikeButton";
import type { CopyablePost } from "@/lib/trade-text";
import { isXStatusUrl } from "@/lib/via";

function ReplyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function PostActionBar({
  post,
  liked,
  showCopy = true,
  onThread = false,
}: {
  post: CopyablePost & {
    id: string;
    product?: string | null;
    upvotes?: number;
    reply_count?: number;
    explorer_url?: string | null;
    journal_explorer_url?: string | null;
    source_url?: string | null;
    via?: string | null;
  };
  liked?: boolean;
  showCopy?: boolean;
  onThread?: boolean;
  /** @deprecated unused — kept for call-site compat */
  productBadge?: string | null;
}) {
  const explorer =
    (post.journal_explorer_url && post.journal_explorer_url.startsWith("http")
      ? post.journal_explorer_url
      : null) ||
    (post.explorer_url && post.explorer_url.startsWith("http") ? post.explorer_url : null);
  const sourceUrl = post.source_url?.trim() || null;
  const xPermalink = isXStatusUrl(sourceUrl) ? sourceUrl : null;
  const replyCount = post.reply_count ?? 0;
  const replyLabel = replyCount > 0 ? String(replyCount) : "0";

  return (
    <div className="post-action-bar">
      <div className="post-action-bar-left">
        {explorer ? (
          <>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="post-action-btn post-action-btn--muted post-action-btn--icon"
              aria-label="View on-chain transaction"
              title="On-chain · view transaction"
            >
              <PhosphorLinkIcon size={15} />
            </a>
            <span className="post-action-sep" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <LikeButton postId={post.id} initialCount={post.upvotes ?? 0} initialLiked={liked ?? false} />
        <span className="post-action-sep" aria-hidden>
          ·
        </span>
        {onThread ? (
          <span className="post-action-btn post-action-btn--static">
            <ReplyIcon />
            Reply
            <span className="post-action-count">{replyLabel}</span>
          </span>
        ) : (
          <Link href={`/post/${post.id}`} className="post-action-btn">
            <ReplyIcon />
            Reply
            {replyCount > 0 ? <span className="post-action-count">{replyLabel}</span> : null}
          </Link>
        )}
        {xPermalink ? (
          <>
            <span className="post-action-sep" aria-hidden>
              ·
            </span>
            <a href={xPermalink} target="_blank" rel="noopener noreferrer" className="post-action-btn post-action-btn--muted">
              View on X
            </a>
          </>
        ) : null}
      </div>

      {showCopy ? (
        <div className="post-action-bar-right">
          <CopyPostButton postId={post.id} />
        </div>
      ) : null}
    </div>
  );
}
