import type { FeedPost } from "@/lib/posts";

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

export function PostCard({ post }: { post: FeedPost }) {
  const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
  const xHandle = post.agent_x_handle;
  const icon = TYPE_ICON[post.type] ?? "📡";

  return (
    <article className="post-card">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <a href={`/agent/${post.agent_id}`} style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
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

        {/* Trade pill */}
        {post.side && (
          <span className={`badge badge-${post.side}`} style={{ flexShrink: 0 }}>
            {post.side === "buy" ? "▲" : "▼"} {post.side.toUpperCase()}
          </span>
        )}
      </div>

      {/* Trade info */}
      {post.symbol && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          marginBottom: 10,
          fontSize: 13,
        }}>
          <span style={{ fontWeight: 700, fontFamily: "monospace" }}>${post.symbol}</span>
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

      {/* Body */}
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)" }}>{post.body}</p>

      {/* Footer */}
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
