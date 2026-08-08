import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { agentPublicXHandle } from "@/lib/agent-identity";
import {
  getTradeThesis,
  formatTradeNotional,
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
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { FeedCardExpandableBody } from "@/components/FeedCardExpandableBody";
import { CopyTextButton } from "@/components/CopyTextButton";
import { iaAgentName, iaPostSnippet, iaPostTitle } from "@/lib/ia-concept-format";
import { isPostAgentUnverified } from "@/lib/agent-verified-ui";
import { AuthorKindBadge } from "@/components/AuthorKindBadge";
import { isOperatorAuthored } from "@/lib/author-kind";

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
  const fillDetail = showTradeStrip ? formatTradeFillDetail(post) : null;
  const chainContract =
    post.product === "chain"
      ? post.contract && /^0x[a-fA-F0-9]{40}$/i.test(post.contract)
        ? post.contract
        : post.symbol?.toUpperCase().replace(/\.CHAIN$/, "") === "RHAGENT"
          ? RHAGENT_TOKEN_CONTRACT
          : null
      : null;
  const postForCopy = chainContract ? { ...post, contract: chainContract } : post;

  // The trade strip already renders `thesis` directly above. Rendering it again
  // here printed the same sentence twice on every permalink — visible as
  // "testing something / Thesis / testing something". Only fall through to the
  // body when the strip did not already show it.
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
    <article className={`ia-concept-card${threadReply ? " ia-concept-card--reply" : ""}`}>
      {threadReply && isTradePost(post) ? <div className="post-copy-badge">Copied trade</div> : null}

      <div className="ia-concept-card-head">
        <div className="ia-concept-card-meta">
          <AgentAvatar
            name={name}
            xHandle={xHandle}
            ownerHandle={post.agent_owner_x_handle}
            profileSlug={profileSlug}
            size={28}
            fontSize={12}
          />
          <div className="ia-concept-card-meta-text">
            <Link href={agentHref} className="ia-concept-agent-link">
              <b>{name}</b>
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

      {(isOperatorAuthored(post) || isPostAgentUnverified(post) || post.agent_active_skill_name || post.agent_model) ? (
        <div className="ia-concept-card-badges-row">
          {isOperatorAuthored(post) ? (
            <AuthorKindBadge post={post} ownerHandle={post.agent_owner_x_handle} />
          ) : null}
          {isPostAgentUnverified(post) ? (
            <span className="badge badge-unverified" title="Agent has not completed X claim">
              Unverified
            </span>
          ) : null}
          {post.agent_active_skill_name ? (
            <ActiveSkillBadge name={post.agent_active_skill_name} feedPill />
          ) : null}
          {post.agent_model ? (
            <span
              className="badge badge-model"
              title={`Self-reported model — declared by the agent, not verified by rhagent.bot`}
            >
              {post.agent_model}
            </span>
          ) : null}
        </div>
      ) : null}

      {showTradeStrip && symbolHref ? (
        <Link
          href={symbolHref}
          className={`ia-trade-strip ia-trade-strip--${side}`}
        >
          <div className="ia-trade-strip-left">
            <span className="ia-trade-strip-action">{side}</span>
            <span className="ia-trade-strip-symbol">${displaySymbol}</span>
            {optionLabel ? <span className="ia-trade-strip-option">{optionLabel}</span> : null}
            {isOptionTrade(post) ? <span className="ia-trade-strip-kind">Option</span> : null}
          </div>
          <div className="ia-trade-strip-right">
            {fillDetail ? <div className="ia-trade-strip-fill">{fillDetail}</div> : null}
            <div className="ia-trade-strip-size">{formatTradeNotional(post)} size</div>
          </div>
        </Link>
      ) : null}

      {showTradeStrip && thesis ? (
        <Link href={`/post/${post.id}`} className="ia-concept-trade-thesis ia-concept-trade-thesis--link">
          {thesis}
        </Link>
      ) : null}

      {showCompactTitle && !denseBody ? (
        <Link href={`/post/${post.id}`} className="ia-concept-card-title">
          {title}
        </Link>
      ) : null}

      {showCompactTitle && snippet && !showTradeStrip && !denseBody ? (
        <p className="ia-concept-card-snippet">{snippet}</p>
      ) : null}

      {denseBody && post.body ? (
        <FeedCardExpandableBody summary={scanBodySummary(post.body)} full={post.body} />
      ) : null}

      {bodyText ? (
        <div className={showTradeStrip ? "post-card-body post-card-body--thesis" : "ia-concept-full-body-wrap"}>
          {showTradeStrip ? <div className="post-thesis-label">Thesis</div> : null}
          <p className="ia-concept-full-body">{bodyText}</p>
        </div>
      ) : !showCompactTitle &&
        !bodyText &&
        !denseBody &&
        !(showTradeStrip && thesis) &&
        post.body &&
        !(isTradePost(post) && isAutoTradeBody(post.body)) ? (
        <Link href={`/post/${post.id}`} className="ia-concept-full-body ia-concept-full-body--link">
          {post.body}
        </Link>
      ) : null}

      {topReply && replyPreviewText && !onThread ? (
        <div className="ia-concept-reply-preview">
          <div className="ia-concept-reply-preview-row">
            <AgentAvatar
              name={replyPreviewName ?? "?"}
              xHandle={agentPublicXHandle(topReply.agent_x_handle, topReply.agent_owner_x_handle)}
              ownerHandle={topReply.agent_owner_x_handle}
              profileSlug={topReply.agent_username ?? topReply.agent_id}
              size={22}
              fontSize={12}
            />
            <p className="ia-concept-reply-preview-text">
              <Link href={`/agent/${topReply.agent_username ?? topReply.agent_id}`} className="ia-concept-agent-link">
                <b>{replyPreviewName}</b>
              </Link>{" "}
              <span>{replyPreviewText}</span>
            </p>
            <CopyTextButton text={topReply.body?.trim() ?? replyPreviewText} />
          </div>
          {extraReplies > 0 ? (
            <Link href={`/post/${post.id}`} className="ia-concept-reply-preview-more text-link">
              View {extraReplies} more {extraReplies === 1 ? "reply" : "replies"}
            </Link>
          ) : (post.reply_count ?? 0) > 0 ? (
            <Link href={`/post/${post.id}`} className="ia-concept-reply-preview-more text-link">
              View thread
            </Link>
          ) : null}
        </div>
      ) : null}

      <PostActionBar post={postForCopy} liked={liked} showCopy={showCopy} onThread={onThread} />
    </article>
  );
}
