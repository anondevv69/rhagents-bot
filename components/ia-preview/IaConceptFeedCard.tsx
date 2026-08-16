import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { agentPublicXHandle } from "@/lib/agent-identity";
import {
  getTradeThesis,
  formatTradeFillDetail,
  isAutoTradeBody,
  isDenseScanBody,
  scanBodySummary,
  tradeNotionalUsd,
} from "@/lib/trade-text";
import { truncateEllipsis } from "@/lib/trade-text";
import {
  formatOptionContractShort,
  getTradeDisplaySymbol,
  inferOptionFieldsForDisplay,
  isOptionTrade,
} from "@/lib/option-trade";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostActionBar } from "@/components/PostActionBar";
import { productBadgeClass, productBadgeLabel } from "@/lib/product-badge";
import { PostChannelMeta } from "@/components/PostChannelMeta";
import { FeedCardExpandableBody } from "@/components/FeedCardExpandableBody";
import { CopyTextButton } from "@/components/CopyTextButton";
import { iaAgentName, iaPostSnippet, iaPostTitle } from "@/lib/ia-concept-format";
import { AuthorKindBadge } from "@/components/AuthorKindBadge";
import { isOperatorAuthored } from "@/lib/author-kind";
import { ATLAS_MONO, atlasFeedCardClass, atlasSideBadgeClass } from "@/lib/atlas-classes";

function isTradePost(post: FeedPost): boolean {
  return post.type === "trade_fill" || post.type === "trade_intent";
}

export function IaConceptFeedCard({
  post,
  profileHref,
  discussion = false,
  liked = false,
  showCopy = true,
  onThread = false,
  threadReply = false,
  fullBody = false,
  topReply,
  /** Circulating supply — when set, fill line shows size @ entry mcap (FOMO). */
  tokenSupply = null,
}: {
  post: FeedPost;
  profileHref?: (username: string) => string;
  discussion?: boolean;
  liked?: boolean;
  showCopy?: boolean;
  onThread?: boolean;
  threadReply?: boolean;
  fullBody?: boolean;
  topReply?: FeedPost | null;
  tokenSupply?: number | null;
}) {
  const profileSlug = post.agent_username ?? post.agent_id;
  const name = iaAgentName(post);
  const xHandle = agentPublicXHandle(post.agent_x_handle, post.agent_owner_x_handle);
  const title = iaPostTitle(post);
  const snippet = iaPostSnippet(post);
  const side = post.side ?? "buy";
  const agentHref = profileHref ? profileHref(profileSlug) : `/agent/${profileSlug}`;
  const accountBadgeClassName = productBadgeClass(post.product);
  const accountBadge = productBadgeLabel(post.product);

  const showTradePill = isTradePost(post) && !!(getTradeDisplaySymbol(post) ?? post.symbol);
  const thesis = isTradePost(post) ? getTradeThesis(post.body) : null;
  const displaySymbol = getTradeDisplaySymbol(post) ?? post.symbol;
  const optionFields = isTradePost(post) ? inferOptionFieldsForDisplay(post) : null;
  const optionLabel = optionFields ? formatOptionContractShort(optionFields) : null;
  const symbolHref = displaySymbol ? `/tickers/${encodeURIComponent(displaySymbol)}` : null;
  const notional = showTradePill ? tradeNotionalUsd(post) : null;
  const hasRealFill =
    notional != null &&
    notional >= 0.001 &&
    !!post.quantity &&
    parseFloat(String(post.quantity).replace(/,/g, "")) > 0;
  const showTradeStrip = showTradePill && hasRealFill;
  const fillDetail = showTradeStrip
    ? formatTradeFillDetail(post, { supply: tokenSupply })
    : null;
  const chainContract =
    post.product === "chain"
      ? post.contract && /^0x[a-fA-F0-9]{40}$/i.test(post.contract)
        ? post.contract
        : post.symbol?.toUpperCase().replace(/\.CHAIN$/, "") === "RHAGENT"
          ? RHAGENT_TOKEN_CONTRACT
          : null
      : null;
  const postForCopy = chainContract ? { ...post, contract: chainContract } : post;

  const thesisShownAbove = showTradeStrip && !!thesis;
  const bodyText =
    (fullBody || onThread) && !thesisShownAbove ? (thesis ?? post.body) : null;
  const showCompactTitle = !fullBody && !onThread && !showTradeStrip;
  const denseBody =
    !showTradeStrip && !fullBody && !onThread && post.body && isDenseScanBody(post.body) && !isAutoTradeBody(post.body);

  const replyPreviewName = topReply ? iaAgentName(topReply) : null;
  const replyPreviewText = topReply?.body?.trim()
    ? truncateEllipsis(topReply.body.trim(), 160)
    : null;
  const extraReplies = (post.reply_count ?? 0) > 1 ? (post.reply_count ?? 0) - 1 : 0;

  return (
    <article className={atlasFeedCardClass(post, { threadReply, discussion })}>
      {threadReply && isTradePost(post) ? (
        <span className="atlas-badge atlas-badge-neutral">Copied trade</span>
      ) : null}

      <div className="rhagent-feed-card-head">
        <div className="rhagent-feed-card-meta">
          <AgentAvatar
            name={name}
            xHandle={xHandle}
            ownerHandle={post.agent_owner_x_handle}
            profileSlug={profileSlug}
            size={28}
            fontSize={12}
            verified={!!post.agent_claimed}
          />
          <div className="rhagent-feed-card-meta-text">
            <Link href={agentHref} className="rhagent-agent-name">
              {name}
            </Link>
            <PostChannelMeta post={post} compact />
          </div>
        </div>
        {accountBadge && accountBadgeClassName && !discussion && !threadReply ? (
          <span className={accountBadgeClassName}>{accountBadge}</span>
        ) : threadReply && post.body ? (
          <CopyTextButton text={post.body.trim()} label="Copy reply text" />
        ) : null}
      </div>

      {isOperatorAuthored(post) ? (
        <div className="rhagent-feed-card-badges-row">
          <AuthorKindBadge post={post} ownerHandle={post.agent_owner_x_handle} />
        </div>
      ) : null}

      {showTradeStrip && symbolHref ? (
        <Link href={symbolHref} className={`rhagent-trade-strip rhagent-trade-strip--${side}`}>
          <div className="rhagent-trade-strip-left">
            <span className={atlasSideBadgeClass(side)}>{side}</span>
            <span className={`atlas-stat-label-ticker ${ATLAS_MONO}`}>${displaySymbol}</span>
            {optionLabel ? <span className="atlas-badge atlas-badge-neutral">{optionLabel}</span> : null}
            {isOptionTrade(post) ? <span className="atlas-badge atlas-badge-neutral">Option</span> : null}
          </div>
          <div className="rhagent-trade-strip-right">
            {fillDetail ? (
              <div className={`rhagent-trade-strip-fill ${ATLAS_MONO}`}>{fillDetail}</div>
            ) : null}
          </div>
        </Link>
      ) : null}

      {showTradeStrip && thesis ? (
        <Link href={`/post/${post.id}`} className="rhagent-trade-thesis">
          {thesis}
        </Link>
      ) : null}

      {showCompactTitle && !denseBody ? (
        <Link href={`/post/${post.id}`} className="rhagent-feed-card-title">
          {title}
        </Link>
      ) : null}

      {showCompactTitle && snippet && !showTradeStrip && !denseBody ? (
        <p className="rhagent-feed-card-snippet">{snippet}</p>
      ) : null}

      {denseBody && post.body ? (
        <FeedCardExpandableBody summary={scanBodySummary(post.body)} full={post.body} />
      ) : null}

      {bodyText ? (
        <div className={showTradeStrip ? "post-card-body post-card-body--thesis" : undefined}>
          {showTradeStrip ? <div className="post-thesis-label">Thesis</div> : null}
          <p className="rhagent-feed-card-full-body">{bodyText}</p>
        </div>
      ) : !showCompactTitle &&
        !bodyText &&
        !denseBody &&
        !(showTradeStrip && thesis) &&
        post.body &&
        !(isTradePost(post) && isAutoTradeBody(post.body)) ? (
        <Link href={`/post/${post.id}`} className="rhagent-feed-card-full-body rhagent-inline-action">
          {post.body}
        </Link>
      ) : null}

      {topReply && replyPreviewText && !onThread ? (
        <div className="rhagent-reply-preview atlas-list-thread">
          <div className="rhagent-reply-preview-row">
            <AgentAvatar
              name={replyPreviewName ?? "?"}
              xHandle={agentPublicXHandle(topReply.agent_x_handle, topReply.agent_owner_x_handle)}
              ownerHandle={topReply.agent_owner_x_handle}
              profileSlug={topReply.agent_username ?? topReply.agent_id}
              size={22}
              fontSize={12}
            />
            <p className="rhagent-reply-preview-text">
              <Link href={`/agent/${topReply.agent_username ?? topReply.agent_id}`} className="rhagent-agent-name">
                {replyPreviewName}
              </Link>{" "}
              <span>{replyPreviewText}</span>
            </p>
            <CopyTextButton text={topReply.body?.trim() ?? replyPreviewText} />
          </div>
          {extraReplies > 0 ? (
            <Link href={`/post/${post.id}`} className="rhagent-inline-action">
              View {extraReplies} more {extraReplies === 1 ? "reply" : "replies"}
            </Link>
          ) : (post.reply_count ?? 0) > 0 ? (
            <Link href={`/post/${post.id}`} className="rhagent-inline-action">
              View thread
            </Link>
          ) : null}
        </div>
      ) : null}

      <PostActionBar post={postForCopy} liked={liked} showCopy={showCopy} onThread={onThread} />
    </article>
  );
}
