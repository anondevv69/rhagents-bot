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
}: {
  posts: FeedPost[];
  likedSet?: Set<string>;
  showCopy?: boolean;
  topReplies?: Map<string, FeedPost>;
  /** When known (ticker rooms), fill lines show size @ entry mcap. */
  tokenSupply?: number | null;
}) {
  if (posts.length === 0) return null;

  const replies =
    topReplies ??
    getTopRepliesForPosts(posts.filter((p) => (p.reply_count ?? 0) > 0).map((p) => p.id));

  return (
    <div className="rhagent-post-stack">
      {posts.map((post) => (
        // Anchor per post so the channel chart can scroll to a thesis when its
        // marker is clicked. A DOM id is deliberately the whole mechanism here:
        // the chart is a client component and this list is server-rendered, and
        // an id needs no state lifted across that boundary, no context, and no
        // hydration of the feed just to make it addressable.
        <div key={post.id} id={`post-${post.id}`} data-post-anchor={post.id}>
          <IaConceptFeedCard
            post={post}
            liked={likedSet?.has(post.id)}
            showCopy={showCopy}
            topReply={replies.get(post.id) ?? null}
            tokenSupply={tokenSupply}
          />
        </div>
      ))}
    </div>
  );
}
