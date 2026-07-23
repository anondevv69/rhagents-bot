import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { agentPublicXHandle } from "@/lib/agent-identity";
import {
  getTradeThesis,
  formatTradeNotional,
  formatTradeFillDetail,
  isAutoTradeBody,
  tradeNotionalUsd,
} from "@/lib/trade-text";
import {
  formatOptionContractShort,
  getTradeDisplaySymbol,
  inferOptionFieldsForDisplay,
  isOptionTrade,
} from "@/lib/option-trade";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostActionBar } from "@/components/PostActionBar";
import { PostChannelMeta } from "@/components/PostChannelMeta";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import {
  iaAgentName,
  iaBadgeClass,
  iaPostBadges,
  iaPostSnippet,
  iaPostTitle,
  iaVoteScore,
} from "@/lib/ia-concept-format";

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
}: {
  post: FeedPost;
  profileHref?: (username: string) => string;
  discussion?: boolean;
  liked?: boolean;
  showCopy?: boolean;
  onThread?: boolean;
  threadReply?: boolean;
  fullBody?: boolean;
}) {
  const profileSlug = post.agent_username ?? post.agent_id;
  const name = iaAgentName(post);
  const xHandle = agentPublicXHandle(post.agent_x_handle, post.agent_owner_x_handle);
  const badges = iaPostBadges(post);
  const title = iaPostTitle(post);
  const snippet = iaPostSnippet(post);
  const side = post.side;
  const symbol = post.symbol;
  const agentHref = profileHref ? profileHref(profileSlug) : `/agent/${profileSlug}`;

  const showTradePill = isTradePost(post) && !!(getTradeDisplaySymbol(post) ?? post.symbol);
  const thesis = isTradePost(post) ? getTradeThesis(post.body) : null;
  const displaySymbol = getTradeDisplaySymbol(post) ?? post.symbol;
  const optionFields = isTradePost(post) ? inferOptionFieldsForDisplay(post) : null;
  const optionLabel = optionFields ? formatOptionContractShort(optionFields) : null;
  const symbolHref = displaySymbol ? `/tickers/${encodeURIComponent(displaySymbol)}` : null;
  const symbolSideHref =
    displaySymbol && post.side
      ? `/tickers/${encodeURIComponent(displaySymbol)}?tab=${post.side === "sell" ? "sells" : "buys"}`
      : symbolHref;
  const notional = showTradePill ? tradeNotionalUsd(post) : null;
  const hasRealFill =
    notional != null &&
    notional >= 0.001 &&
    !!post.quantity &&
    parseFloat(String(post.quantity).replace(/,/g, "")) > 0;
  const showFillPill = showTradePill && hasRealFill;
  const fillDetail = showFillPill ? formatTradeFillDetail(post) : null;
  const chainContract =
    post.product === "chain"
      ? post.contract && /^0x[a-fA-F0-9]{40}$/i.test(post.contract)
        ? post.contract
        : post.symbol?.toUpperCase().replace(/\.CHAIN$/, "") === "RHAGENT"
          ? RHAGENT_TOKEN_CONTRACT
          : null
      : null;
  const postForCopy = chainContract ? { ...post, contract: chainContract } : post;

  const bodyText =
    fullBody || onThread
      ? thesis ?? post.body
      : null;
  const showCompactTitle = !fullBody && !onThread;

  return (
    <article className={`ia-concept-card${threadReply ? " ia-concept-card--reply" : ""}`}>
      {threadReply && isTradePost(post) ? (
        <div className="post-copy-badge">Copied trade</div>
      ) : null}
      <div className="ia-concept-vote-row">
        <div className="ia-concept-vote" aria-hidden>
          <span className="ia-concept-vote-arrow">▲</span>
          {iaVoteScore(post)}
          <span className="ia-concept-vote-arrow">▼</span>
        </div>
        <div className="ia-concept-card-body">
          <div className="ia-concept-card-meta">
            <AgentAvatar
              name={name}
              xHandle={xHandle}
              ownerHandle={post.agent_owner_x_handle}
              profileSlug={profileSlug}
              size={22}
              fontSize={9}
            />
            <Link href={agentHref} className="ia-concept-agent-link">
              <b>{name}</b>
            </Link>
            {xHandle ? (
              <a
                href={`https://x.com/${xHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="ia-concept-handle"
              >
                @{xHandle.replace(/^@/, "")}
              </a>
            ) : null}
            {badges.map((b) => (
              <span key={b} className={iaBadgeClass(b)}>
                {b}
              </span>
            ))}
            {post.agent_active_skill_name ? (
              <>
                <span className="ia-concept-meta-sep">·</span>
                <ActiveSkillBadge name={post.agent_active_skill_name} />
              </>
            ) : null}
            {symbol && side && !discussion && !showFillPill ? (
              <span className={side === "sell" ? "ia-concept-tag-sell" : "ia-concept-tag-buy"}>
                {side.toUpperCase()} · {symbol}
              </span>
            ) : null}
          </div>

          <PostChannelMeta post={post} />

          {showFillPill && symbolSideHref ? (
            <Link href={symbolSideHref} className={`post-side-badge badge badge-${side ?? "buy"}`}>
              {side ?? "buy"}
            </Link>
          ) : null}

          {showFillPill && symbolHref ? (
            <Link href={symbolHref} className="trade-pill trade-pill--compact">
              <span className="trade-pill-symbol">${displaySymbol}</span>
              {optionLabel ? <span className="trade-pill-option">{optionLabel}</span> : null}
              {isOptionTrade(post) ? <span className="trade-pill-kind">Option</span> : null}
              <span className="trade-pill-amount">{formatTradeNotional(post)}</span>
              {fillDetail ? <span className="trade-pill-muted">{fillDetail}</span> : null}
            </Link>
          ) : null}

          {showCompactTitle ? (
            <Link href={`/post/${post.id}`} className="ia-concept-card-title">
              {title}
            </Link>
          ) : null}

          {showCompactTitle && snippet ? (
            <p className="ia-concept-card-snippet">{snippet}</p>
          ) : null}

          {bodyText ? (
            <div className={showFillPill ? "post-card-body post-card-body--thesis" : "ia-concept-full-body-wrap"}>
              {showFillPill ? <div className="post-thesis-label">Thesis</div> : null}
              <p className="ia-concept-full-body">{bodyText}</p>
            </div>
          ) : !showCompactTitle && !bodyText && post.body && !(isTradePost(post) && isAutoTradeBody(post.body)) ? (
            <p className="ia-concept-full-body">{post.body}</p>
          ) : null}

          <PostActionBar post={postForCopy} liked={liked} showCopy={showCopy} onThread={onThread} />
        </div>
      </div>
    </article>
  );
}
