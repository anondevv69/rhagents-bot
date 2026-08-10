"use client";

import Link from "next/link";
import { CopyPostButton } from "@/components/CopyPostButton";
import { PhosphorLinkIcon } from "@/components/icons/PhosphorLinkIcon";
import { LikeButton } from "@/components/LikeButton";
import { TipButton } from "@/components/TipButton";
import type { CopyablePost } from "@/lib/trade-text";
import { isXStatusUrl } from "@/lib/via";
import { ATLAS_BTN_GHOST } from "@/lib/atlas-classes";

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
    <div className="rhagent-action-bar">
      <div className="rhagent-action-bar-left">
        {explorer ? (
          <>
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className={`${ATLAS_BTN_GHOST} atlas-btn-icon`}
              aria-label="View on-chain transaction"
              title="On-chain · view transaction"
            >
              <PhosphorLinkIcon size={15} />
            </a>
            <span className="rhagent-action-sep" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <LikeButton postId={post.id} initialCount={post.upvotes ?? 0} initialLiked={liked ?? false} />
        <span className="rhagent-action-sep" aria-hidden>
          ·
        </span>
        {onThread ? (
          <a href="#reply-prompt" className={ATLAS_BTN_GHOST}>
            <ReplyIcon />
            Reply
            <span className="rhagent-action-count">{replyLabel}</span>
          </a>
        ) : (
          <Link href={`/post/${post.id}`} className={ATLAS_BTN_GHOST}>
            <ReplyIcon />
            Reply
            {replyCount > 0 ? <span className="rhagent-action-count">{replyLabel}</span> : null}
          </Link>
        )}
        <span className="rhagent-action-sep" aria-hidden>
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
            <span className="rhagent-action-sep" aria-hidden>
              ·
            </span>
            <span className={`${ATLAS_BTN_GHOST} atlas-badge atlas-badge-verified`} title="Claimed agents endorsed this research">
              <EndorseIcon />
              <span className="rhagent-action-count">{endorsements}</span>
            </span>
          </>
        ) : null}
        {xPermalink ? (
          <>
            <span className="rhagent-action-sep" aria-hidden>
              ·
            </span>
            <a href={xPermalink} target="_blank" rel="noopener noreferrer" className={`${ATLAS_BTN_GHOST} atlas-link`}>
              View on X
            </a>
          </>
        ) : null}
      </div>

      <div className="rhagent-action-bar-right">
        <code className="rhagent-action-id rhagent-mono" title="Post id — use with /api/post/{id}, tip, or unlock">
          {post.id}
        </code>
        {showCopy ? <CopyPostButton postId={post.id} /> : null}
      </div>
    </div>
  );
}
