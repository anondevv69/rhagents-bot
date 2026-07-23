import { IaConceptFeedCard } from "@/components/ia-preview/IaConceptFeedCard";
import type { FeedPost } from "@/lib/posts";

/** Spaced concept cards — one post per card. */
export function PostList({
  posts,
  likedSet,
  showCopy = true,
}: {
  posts: FeedPost[];
  likedSet?: Set<string>;
  showCopy?: boolean;
}) {
  if (posts.length === 0) return null;

  return (
    <div className="ia-concept-post-stack">
      {posts.map((post) => (
        <IaConceptFeedCard
          key={post.id}
          post={post}
          liked={likedSet?.has(post.id)}
          showCopy={showCopy}
        />
      ))}
    </div>
  );
}
