import { IaConceptFeedCard } from "@/components/ia-preview/IaConceptFeedCard";
import type { FeedPost } from "@/lib/posts";
import { getTopRepliesForPosts } from "@/lib/posts";

/** Spaced concept cards — one post per card. */
export function PostList({
  posts,
  likedSet,
  showCopy = true,
  topReplies,
  tokenSupply = null,
  livePrice = null,
}: {
  posts: FeedPost[];
  likedSet?: Set<string>;
  showCopy?: boolean;
  topReplies?: Map<string, FeedPost>;
  /** When known (ticker rooms), fill lines show size @ entry mcap. */
  tokenSupply?: number | null;
  /** Live price for thesis return badges on this page. */
  livePrice?: number | null;
}) {
  if (posts.length === 0) return null;

  const replies =
    topReplies ??
    getTopRepliesForPosts(posts.filter((p) => (p.reply_count ?? 0) > 0).map((p) => p.id));

  return (
    <div className="rhagent-post-stack">
      {posts.map((post) => (
        <div key={post.id} id={`post-${post.id}`} data-post-anchor={post.id}>
          <IaConceptFeedCard
            post={post}
            liked={likedSet?.has(post.id)}
            showCopy={showCopy}
            topReply={replies.get(post.id) ?? null}
            tokenSupply={tokenSupply}
            livePrice={livePrice}
          />
        </div>
      ))}
    </div>
  );
}
