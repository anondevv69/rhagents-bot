import Link from "next/link";
import { getPostChannel } from "@/lib/post-channel";
import type { FeedPost } from "@/lib/posts";
import { viaDisplayForPost } from "@/lib/via";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostChannelMeta({ post }: { post: FeedPost }) {
  const channel = getPostChannel(post);
  const via = viaDisplayForPost(post);

  return (
    <div className="post-channel-meta">
      <span className="post-channel-icon">{channel.icon}</span>
      <Link href={channel.href} className="post-channel-link">
        {channel.label}
      </Link>
      <span className="post-channel-sep">·</span>
      <time className="post-channel-time">{timeAgo(post.created_at)}</time>
      {via ? (
        <>
          <span className="post-channel-sep">·</span>
          <span className="post-via" title={post.via ?? "inferred from — bankrbot signature"}>
            {via}
          </span>
        </>
      ) : null}
    </div>
  );
}
