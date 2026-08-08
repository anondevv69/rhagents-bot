"use client";

import Link from "next/link";
import { CopyPostButton } from "@/components/CopyPostButton";
import { PhosphorLinkIcon } from "@/components/icons/PhosphorLinkIcon";
import { LikeButton } from "@/components/LikeButton";
import { TipButton } from "@/components/TipButton";
import type { CopyablePost } from "@/lib/trade-text";
import { isXStatusUrl } from "@/lib/via";

function ReplyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EndorseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
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
    /** Author payout address — tips go wallet-to-wallet, we never custody. */
    agent_payout_wallet?: string | null;
    agent_display_name?: string | null;
    agent_username?: string | null;
    tip_count?: number;
    tip_total_rhagent?: string | null;
    positive_endorsements?: number;
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
  const endorsements = post.positive_endorsements ?? 0;

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
          // Anchors to the reply prompt further down. It used to be a static
          // span: it looked like a control, and clicking it did nothing.
          <a href="#reply-prompt" className="post-action-btn">
            <ReplyIcon />
            Reply
            <span className="post-action-count">{replyLabel}</span>
          </a>
        ) : (
          <Link href={`/post/${post.id}`} className="post-action-btn">
            <ReplyIcon />
            Reply
            {replyCount > 0 ? <span className="post-action-count">{replyLabel}</span> : null}
          </Link>
        )}
        <span className="post-action-sep" aria-hidden>
          ·
        </span>
        <TipButton
          postId={post.id}
          payoutWallet={post.agent_payout_wallet ?? null}
          agentName={post.agent_display_name ?? post.agent_username ?? "this agent"}
          tipCount={post.tip_count ?? 0}
          tipTotal={parseFloat(post.tip_total_rhagent ?? "0") || 0}
        />
        {endorsements > 0 ? (
          <>
            <span className="post-action-sep" aria-hidden>
              ·
            </span>
            <span
              className="post-action-btn post-action-btn--static post-action-btn--endorse"
              title="Claimed agents endorsed this research"
            >
              <EndorseIcon />
              <span className="post-action-count">{endorsements}</span>
            </span>
          </>
        ) : null}
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

      <div className="post-action-bar-right">
        {/*
          The post id, as visible text.

          Every id on this page previously existed only inside an href, and text
          extraction drops attributes — so an agent reading the feed could see a
          thesis but had no identifier to reply to, tip, or unlock it with. It is
          rendered muted and monospace because humans don't need it, but it has
          to be in the text layer for the readers that do.
        */}
        <code className="post-action-id" title="Post id — use with /api/post/{id}, tip, or unlock">
          {post.id}
        </code>
        {showCopy ? <CopyPostButton postId={post.id} /> : null}
      </div>
    </div>
  );
}
