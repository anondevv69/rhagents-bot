import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { agentPublicXHandle } from "@/lib/agent-identity";
import { isAutoTradeBody, getTradeThesis, formatTradeNotional, formatTradeFillDetail, tradeNotionalUsd } from "@/lib/trade-text";
import {
  formatOptionContractShort,
  getTradeDisplaySymbol,
  inferOptionFieldsForDisplay,
  isOptionTrade,
} from "@/lib/option-trade";
import { getChainTickerMeta } from "@/lib/chain-tokens";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostActionBar } from "@/components/PostActionBar";
import { PostChannelMeta } from "@/components/PostChannelMeta";

function isTradePost(post: FeedPost): boolean {
  return post.type === "trade_fill" || post.type === "trade_intent";
}

export function PostCard({
  post,
  showCopy = true,
  liked = false,
  standalone = false,
  onThread = false,
  threadReply = false,
}: {
  post: FeedPost;
  showCopy?: boolean;
  liked?: boolean;
  standalone?: boolean;
  onThread?: boolean;
  /** Reply on a post thread — e.g. copy-trade fill. */
  threadReply?: boolean;
}) {
  const profileSlug = post.agent_username ?? post.agent_id;
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const xHandle = agentPublicXHandle(post.agent_x_handle, post.agent_owner_x_handle);
  const showTradePill = isTradePost(post) && !!(getTradeDisplaySymbol(post) ?? post.symbol);
  const thesis = isTradePost(post) ? getTradeThesis(post.body) : null;
  const showComment = post.body && (!isTradePost(post) || !!thesis);
  const chainContract =
    post.product === "chain" && post.symbol
      ? getChainTickerMeta(post.symbol)?.contract ?? null
      : null;
  const postForCopy = chainContract ? { ...post, contract: chainContract } : post;
  const displaySymbol = getTradeDisplaySymbol(post) ?? post.symbol;
  const optionFields = isTradePost(post) ? inferOptionFieldsForDisplay(post) : null;
  const optionLabel = optionFields ? formatOptionContractShort(optionFields) : null;
  const symbolHref = displaySymbol
    ? `/tickers/${encodeURIComponent(displaySymbol)}`
    : null;
  const symbolSideHref = displaySymbol && post.side
    ? `/tickers/${encodeURIComponent(displaySymbol)}?tab=${post.side === "sell" ? "sells" : "buys"}`
    : symbolHref;
  const side = post.side ?? "buy";
  const notional = showTradePill ? tradeNotionalUsd(post) : null;
  const hasRealFill =
    notional != null &&
    notional >= 0.001 &&
    !!post.quantity &&
    parseFloat(String(post.quantity).replace(/,/g, "")) > 0;
  /** Hide $0.00 / 0 @ $0.00 pills from blocked placeholder "fills". */
  const showFillPill = showTradePill && hasRealFill;
  const fillDetail = showFillPill ? formatTradeFillDetail(post) : null;

  return (
    <article className={`post-card${standalone ? " post-card--standalone card" : ""}${threadReply ? " post-card--thread-reply" : ""}`}>
      {threadReply && isTradePost(post) ? (
        <div className="post-copy-badge">Copied trade</div>
      ) : null}
      <div className="post-card-header">
        <AgentAvatar
          name={name}
          xHandle={xHandle}
          ownerHandle={post.agent_owner_x_handle}
          profileSlug={profileSlug}
          size={36}
          fontSize={14}
        />
        <div className="post-card-header-main">
          <div className="post-card-identity">
            <Link href={`/agent/${profileSlug}`} className="post-card-name">
              {name}
            </Link>
            {xHandle ? (
              <a
                href={`https://x.com/${xHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="post-card-handle"
              >
                @{xHandle.replace(/^@/, "")}
              </a>
            ) : null}
          </div>
          <PostChannelMeta post={post} />
        </div>

        {showFillPill && symbolSideHref ? (
          <Link href={symbolSideHref} className={`post-side-badge badge badge-${side}`}>
            {side}
          </Link>
        ) : null}
      </div>

      {showFillPill && symbolHref ? (
        <Link href={symbolHref} className="trade-pill trade-pill--compact">
          <span className="trade-pill-symbol">${displaySymbol}</span>
          {optionLabel ? <span className="trade-pill-option">{optionLabel}</span> : null}
          {isOptionTrade(post) ? <span className="trade-pill-kind">Option</span> : null}
          <span className="trade-pill-amount">{formatTradeNotional(post)}</span>
          {fillDetail ? <span className="trade-pill-muted">{fillDetail}</span> : null}
        </Link>
      ) : null}

      {showComment ? (
        <div className={showFillPill ? "post-card-body post-card-body--thesis" : "post-card-body"}>
          {showFillPill ? <div className="post-thesis-label">Thesis</div> : null}
          <p className="post-card-text">{thesis ?? post.body}</p>
        </div>
      ) : isTradePost(post) && post.body && isAutoTradeBody(post.body) ? null : post.body ? (
        <p className="post-card-text">{post.body}</p>
      ) : null}

      <PostActionBar post={postForCopy} liked={liked} showCopy={showCopy} onThread={onThread} />
    </article>
  );
}
