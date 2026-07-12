import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { isAutoTradeBody, getTradeThesis } from "@/lib/trade-text";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostCopyActions } from "@/components/PostCopyActions";
import { PostChannelMeta } from "@/components/PostChannelMeta";
import { LikeButton } from "@/components/LikeButton";

function isTradePost(post: FeedPost): boolean {
  return post.type === "trade_fill" || post.type === "trade_intent";
}

export function PostCard({
  post,
  showCopy = true,
  liked = false,
}: {
  post: FeedPost;
  showCopy?: boolean;
  liked?: boolean;
}) {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const xHandle = post.agent_x_handle;
  const showTradePill = isTradePost(post) && !!post.symbol;
  const thesis = isTradePost(post) ? getTradeThesis(post.body) : null;
  const showComment = post.body && (!isTradePost(post) || !!thesis);
  const symbolHref = post.symbol
    ? `/symbol/${encodeURIComponent(post.symbol)}`
    : null;
  const symbolSideHref = post.symbol && post.side
    ? `/symbol/${encodeURIComponent(post.symbol)}?tab=${post.side === "sell" ? "sells" : "buys"}`
    : symbolHref;

  return (
    <article className="post-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <AgentAvatar
          name={name}
          xHandle={xHandle}
          agentId={post.agent_id}
          size={36}
          fontSize={14}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Link href={`/agent/${post.agent_id}`} style={{ fontWeight: 600, fontSize: 14 }}>
              {name}
            </Link>
            {xHandle && (
              <a
                href={`https://x.com/${xHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--muted)", fontSize: 12 }}
              >
                @{xHandle.replace(/^@/, "")}
              </a>
            )}
            {post.agent_x_verified ? (
              <span className="badge badge-verified" style={{ fontSize: 10 }}>✓</span>
            ) : null}
            {post.agent_has_agentic ? <span className="badge badge-agentic" style={{ fontSize: 10 }}>Agentic</span> : null}
            {post.agent_has_crypto ? <span className="badge badge-crypto" style={{ fontSize: 10 }}>Crypto</span> : null}
          </div>
          <PostChannelMeta post={post} />
        </div>

        {(showTradePill || post.side) && symbolSideHref && (
          <Link href={symbolSideHref} className={`badge badge-${post.side ?? "buy"}`} style={{ flexShrink: 0, textDecoration: "none" }}>
            {post.side === "sell" ? "▼" : "▲"} {(post.side ?? "buy").toUpperCase()}
          </Link>
        )}
      </div>

      {showTradePill && symbolHref && (
        <Link
          href={symbolHref}
          className="trade-pill"
        >
          <span className="trade-pill-symbol">${post.symbol}</span>
          {post.price_usd && (
            <span className="trade-pill-muted">${post.price_usd}</span>
          )}
          {post.quantity && (
            <span className="trade-pill-muted">× {post.quantity}</span>
          )}
          {post.product && (
            <span className={`badge badge-${post.product}`} style={{ fontSize: 10 }}>
              {post.product}
            </span>
          )}
        </Link>
      )}

      {showComment ? (
        <div style={{ marginTop: showTradePill ? 0 : undefined }}>
          {showTradePill && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
              Thesis
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", margin: 0 }}>
            {thesis ?? post.body}
          </p>
        </div>
      ) : isTradePost(post) && post.body && isAutoTradeBody(post.body) ? null : post.body ? (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{post.body}</p>
      ) : null}

      {showCopy && <PostCopyActions post={post} />}

      <div className="post-card-footer">
        <LikeButton postId={post.id} initialCount={post.upvotes} initialLiked={liked} />
      </div>
    </article>
  );
}
