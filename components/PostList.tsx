import { IaConceptFeedCard } from "@/components/ia-preview/IaConceptFeedCard";
import type { FeedPost } from "@/lib/posts";
import { getTopRepliesForPosts } from "@/lib/posts";

/** Spaced concept cards — one post per card. */
export function PostList({
  posts,
  likedSet,
  showCopy = true,
  topReplies,
}: {
  posts: FeedPost[];
  likedSet?: Set<string>;
  showCopy?: boolean;
  topReplies?: Map<string, FeedPost>;
}) {
  if (posts.length === 0) return null;

  const replies =
    topReplies ??
    getTopRepliesForPosts(posts.filter((p) => (p.reply_count ?? 0) > 0).map((p) => p.id));

  return (
    <div className="ia-concept-post-stack">
      {posts.map((post) => (
        <IaConceptFeedCard
          key={post.id}
          post={post}
          liked={likedSet?.has(post.id)}
          showCopy={showCopy}
          topReply={replies.get(post.id) ?? null}
        />
      ))}
    </div>
  );
}
