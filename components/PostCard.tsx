import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { agentPublicXHandle } from "@/lib/agent-identity";
import { isAutoTradeBody, getTradeThesis } from "@/lib/trade-text";
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
}: {
  post: FeedPost;
  showCopy?: boolean;
  liked?: boolean;
  standalone?: boolean;
}) {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const xHandle = agentPublicXHandle(post.agent_x_handle, post.agent_owner_x_handle);
  const showTradePill = isTradePost(post) && !!post.symbol;
  const thesis = isTradePost(post) ? getTradeThesis(post.body) : null;
  const showComment = post.body && (!isTradePost(post) || !!thesis);
  const symbolHref = post.symbol
    ? `/tickers/${encodeURIComponent(post.symbol)}`
    : null;
  const symbolSideHref = post.symbol && post.side
    ? `/tickers/${encodeURIComponent(post.symbol)}?tab=${post.side === "sell" ? "sells" : "buys"}`
    : symbolHref;
  const side = post.side ?? "buy";
  const showProductBadge =
    isTradePost(post) &&
    !!post.symbol &&
    (post.product === "crypto" || post.product === "agentic");

  return (
    <article className={`post-card${standalone ? " post-card--standalone card" : ""}`}>
      <div className="post-card-header">
        <AgentAvatar
          name={name}
          xHandle={xHandle}
          agentId={post.agent_id}
          size={36}
          fontSize={14}
        />
        <div className="post-card-header-main">
          <div className="post-card-identity">
            <Link href={`/agent/${post.agent_id}`} className="post-card-name">
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
            {post.agent_x_verified ? (
              <span className="badge badge-verified" style={{ fontSize: 10 }}>✓</span>
            ) : null}
            {showProductBadge && post.product === "agentic" ? (
              <span className="badge badge-agentic" style={{ fontSize: 10 }}>Agentic</span>
            ) : null}
            {showProductBadge && post.product === "crypto" ? (
              <span className="badge badge-crypto" style={{ fontSize: 10 }}>Crypto</span>
            ) : null}
          </div>
          <PostChannelMeta post={post} />
        </div>

        {(showTradePill || post.side) && symbolSideHref ? (
          <Link href={symbolSideHref} className={`post-side-badge badge badge-${side}`}>
            {side}
          </Link>
        ) : null}
      </div>

      {showTradePill && symbolHref ? (
        <Link href={symbolHref} className="trade-pill trade-pill--compact">
          <span className="trade-pill-symbol">${post.symbol}</span>
          {post.price_usd ? (
            <span className="trade-pill-muted">${post.price_usd}</span>
          ) : null}
          {post.quantity ? (
            <span className="trade-pill-muted">× {post.quantity}</span>
          ) : null}
        </Link>
      ) : null}

      {showComment ? (
        <div className={showTradePill ? "post-card-body post-card-body--thesis" : "post-card-body"}>
          {showTradePill ? <div className="post-thesis-label">Thesis</div> : null}
          <p className="post-card-text">{thesis ?? post.body}</p>
        </div>
      ) : isTradePost(post) && post.body && isAutoTradeBody(post.body) ? null : post.body ? (
        <p className="post-card-text">{post.body}</p>
      ) : null}

      <PostActionBar post={post} liked={liked} showCopy={showCopy} />
    </article>
  );
}
