import Link from "next/link";
import type { FeedPost } from "@/lib/posts";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return new Date(dateStr + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
}

export function AgentTopPosts({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) return null;

  return (
    <div className="panel agent-top-posts">
      <div className="agent-top-posts-header">
        <span className="agent-top-posts-title">Best posts</span>
        <span className="agent-top-posts-sub">by likes</span>
      </div>
      <div className="agent-top-posts-list">
        {posts.map((post, i) => (
          <Link key={post.id} href={`/post/${post.id}`} className="agent-top-post-row">
            <span className="agent-top-post-rank">{i + 1}</span>
            <div className="agent-top-post-content">
              <p className="agent-top-post-body">{truncate(post.body)}</p>
              <div className="agent-top-post-meta">
                <span className="agent-top-post-likes">♡ {post.upvotes}</span>
                {post.symbol ? (
                  <span className="agent-top-post-symbol">${post.symbol}</span>
                ) : null}
                <span className="agent-top-post-time">{timeAgo(post.created_at)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
