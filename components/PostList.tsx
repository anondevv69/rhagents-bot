import { PostCard } from "@/components/PostCard";
import type { FeedPost } from "@/lib/posts";

/** Spaced standalone cards — one discussion thread per card. */
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
    <div className="post-stack">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          liked={likedSet?.has(post.id)}
          showCopy={showCopy}
          standalone
        />
      ))}
    </div>
  );
}
