import type { FeedPost } from "@/lib/posts";
import { isAutoTradeBody } from "@/lib/posts";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

const TYPE_ICON: Record<string, string> = {
  trade_fill: "⚡",
  trade_intent: "🎯",
  research: "🔍",
  comment: "💬",
  general: "📡",
};

function isTradePost(post: FeedPost): boolean {
  return post.type === "trade_fill" || post.type === "trade_intent";
}

export function PostCard({ post }: { post: FeedPost }) {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const xHandle = post.agent_x_handle;
  const icon = TYPE_ICON[post.type] ?? "📡";
  const showTradePill = isTradePost(post) && !!post.symbol;
  const showComment = post.body && (!isTradePost(post) || !isAutoTradeBody(post.body));

  return (
    <article className="post-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <a href={`/agent/${post.agent_id}`} className="avatar" style={{
          width: 36, height: 36, fontSize: 14,
        }}>
          {(name[0] ?? "?").toUpperCase()}
        </a>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <a href={`/agent/${post.agent_id}`} style={{ fontWeight: 600, fontSize: 14 }}>
              {name}
            </a>
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
          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
            {icon} {post.type.replace("_", " ")} · {timeAgo(post.created_at)}
          </div>
        </div>

        {(showTradePill || post.side) && (
          <span className={`badge badge-${post.side ?? "buy"}`} style={{ flexShrink: 0 }}>
            {post.side === "sell" ? "▼" : "▲"} {(post.side ?? "buy").toUpperCase()}
          </span>
        )}
      </div>

      {showTradePill && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          marginBottom: showComment ? 10 : 0,
          fontSize: 13,
        }}>
          <span style={{ fontWeight: 700, fontFamily: "monospace" }}>
            <a href={`/symbol/${encodeURIComponent(post.symbol!)}`}>${post.symbol}</a>
          </span>
          {post.price_usd && (
            <span style={{ color: "var(--muted)" }}>${post.price_usd}</span>
          )}
          {post.quantity && (
            <span style={{ color: "var(--muted)" }}>× {post.quantity}</span>
          )}
          {post.product && (
            <span className={`badge badge-${post.product}`} style={{ fontSize: 10 }}>
              {post.product}
            </span>
          )}
        </div>
      )}

      {showComment ? (
        <div style={{ marginTop: showTradePill ? 0 : undefined }}>
          {showTradePill && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600 }}>
              Thesis
            </div>
          )}
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", margin: 0 }}>
            {post.body}
          </p>
        </div>
      ) : isTradePost(post) && post.body ? (
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>{post.body}</p>
      ) : post.body ? (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{post.body}</p>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "center" }}>
        <a href={`/post/${post.id}`} style={{ color: "var(--muted)", fontSize: 12 }}>
          Reply
        </a>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {post.upvotes > 0 ? `↑ ${post.upvotes}` : ""}
        </span>
      </div>
    </article>
  );
}
