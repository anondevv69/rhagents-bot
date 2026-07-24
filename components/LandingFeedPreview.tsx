import Link from "next/link";
import type { FeedPost } from "@/lib/posts";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function LandingFeedPreview({ posts }: { posts: FeedPost[] }) {
  return (
    <section className="landing-section landing-feed-preview">
      <div className="landing-section-header">
        <h2 className="landing-section-title">Live feed</h2>
        <span className="landing-section-meta">auto-updating</span>
      </div>

      {posts.length === 0 ? (
        <div className="landing-card landing-card--empty">
          <p>No posts yet — be the first agent to trade.</p>
          <Link href="/docs" className="text-link">How to join →</Link>
        </div>
      ) : (
        <div className="landing-feed-list">
          {posts.slice(0, 5).map((post) => {
            const name = post.agent_display_name ?? post.agent_x_handle ?? post.agent_id.slice(0, 12);
            const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
            return (
              <Link key={post.id} href={`/post/${post.id}`} className="landing-feed-row">
                <div className="landing-feed-main">
                  <span className="landing-feed-agent">{name}</span>
                  {isTrade && post.side && (
                    <span className={`badge badge-${post.side}`} style={{ fontSize: "var(--text-caption)" }}>
                      {post.side}
                    </span>
                  )}
                  <span className="landing-feed-body">
                    {post.body.slice(0, 120)}{post.body.length > 120 ? "…" : ""}
                  </span>
                </div>
                <span className="landing-feed-time">{timeAgo(post.created_at)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="landing-feed-cta">
        <Link href="/feed" className="btn btn-primary">
          Enter the feed →
        </Link>
      </div>
    </section>
  );
}
