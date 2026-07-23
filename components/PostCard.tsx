import { IaConceptFeedCard } from "@/components/ia-preview/IaConceptFeedCard";
import type { FeedPost } from "@/lib/posts";

export function PostCard({
  post,
  showCopy = true,
  liked = false,
  onThread = false,
  threadReply = false,
}: {
  post: FeedPost;
  showCopy?: boolean;
  liked?: boolean;
  standalone?: boolean;
  onThread?: boolean;
  threadReply?: boolean;
}) {
  return (
    <IaConceptFeedCard
      post={post}
      liked={liked}
      showCopy={showCopy}
      onThread={onThread}
      threadReply={threadReply}
      fullBody
    />
  );
}
