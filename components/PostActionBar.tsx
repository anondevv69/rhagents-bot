"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyTradeButton } from "@/components/CopyTradeButton";
import { LikeButton } from "@/components/LikeButton";
import { useViewerReadOnly } from "@/components/ViewerModeProvider";
import { createAccountEntryHref, loginEntryHref } from "@/lib/auth-entry-urls";
import { isTradePost } from "@/lib/copy-trade";
import type { CopyablePost } from "@/lib/trade-text";
import { isXStatusUrl } from "@/lib/via";

type SessionHint = {
  logged_in: boolean;
  chain_wallet: string | null;
  has_agent: boolean;
};

function accountBadgeForProduct(product: string | null | undefined): string | null {
  if (product === "chain") return "On-chain";
  if (product === "agentic") return "Robinhood brokerage";
  if (product === "crypto") return "Robinhood crypto";
  return null;
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

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
  productBadge,
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
  /** Shown near actions — e.g. "Brokerage linked" when viewer can copy App trades. */
  productBadge?: string | null;
}) {
  const readOnly = useViewerReadOnly();
  const trade = isTradePost(post);
  const [session, setSession] = useState<SessionHint | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/viewer/session")
      .then((r) => r.json())
      .then((d: SessionHint & { ok?: boolean }) => {
        if (cancelled) return;
        setSession({
          logged_in: !!d.logged_in,
          chain_wallet: d.chain_wallet ?? null,
          has_agent: !!d.has_agent,
        });
      })
      .catch(() => {
        if (!cancelled) setSession({ logged_in: false, chain_wallet: null, has_agent: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const explorer =
    (post.journal_explorer_url && post.journal_explorer_url.startsWith("http")
      ? post.journal_explorer_url
      : null) ||
    (post.explorer_url && post.explorer_url.startsWith("http") ? post.explorer_url : null);
  const sourceUrl = post.source_url?.trim() || null;
  const xPermalink = isXStatusUrl(sourceUrl) ? sourceUrl : null;
  const replyCount = post.reply_count ?? 0;
  const replyLabel = replyCount > 0 ? String(replyCount) : "0";

  const isChainTrade = trade && post.product === "chain";
  const needsWallet = isChainTrade && session?.logged_in && !session.chain_wallet;
  const canCopyTrade = session?.logged_in && !readOnly && !needsWallet;

  let copyGateHref = createAccountEntryHref(`/post/${post.id}`);
  let copyGateCaption = "Create an account to copy this trade";
  if (session?.logged_in && needsWallet) {
    copyGateHref = loginEntryHref(`/post/${post.id}`);
    copyGateCaption = "You're logged in — connect a wallet to copy on-chain trades";
  }

  return (
    <div className="post-action-bar">
      <div className="post-action-bar-left">
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
        {explorer ? (
          <>
            <span className="post-action-sep" aria-hidden>
              ·
            </span>
            <a href={explorer} target="_blank" rel="noreferrer" className="post-action-btn post-action-btn--muted">
              onchain
            </a>
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

      {showCopy ? (
        <div className="post-action-bar-right">
          {trade ? (
            canCopyTrade ? (
              <CopyTradeButton post={post} mode="trade" primary />
            ) : (
              <div className="post-copy-gate">
                <Link href={copyGateHref} className="post-action-btn post-action-btn--locked">
                  <LockIcon />
                  Copy trade
                </Link>
                <p className="post-copy-gate-caption">
                  <Link href={copyGateHref} className="text-link">
                    {copyGateCaption} ↗
                  </Link>
                </p>
              </div>
            )
          ) : (
            <CopyTradeButton post={post} mode="reply" />
          )}
          {productBadge ? <span className="post-product-badge">{productBadge}</span> : null}
          {!productBadge && trade && post.product ? (
            <span className="post-product-badge post-product-badge--muted">
              {accountBadgeForProduct(post.product)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { accountBadgeForProduct };
