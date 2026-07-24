import Link from "next/link";
import { getPostChannel } from "@/lib/post-channel";
import type { FeedPost } from "@/lib/posts";
import { isXStatusUrl, viaDisplayForPost } from "@/lib/via";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function PostChannelMeta({ post, compact = false }: { post: FeedPost; compact?: boolean }) {
  const channel = getPostChannel(post);
  const via = viaDisplayForPost(post);
  const sourceUrl = post.source_url?.trim() || null;
  const viaHref = sourceUrl && (isXStatusUrl(sourceUrl) || sourceUrl.startsWith("https://")) ? sourceUrl : null;

  return (
    <div className={`post-channel-meta${compact ? " post-channel-meta--compact" : ""}`}>
      {!compact ? (
        <>
          <span className="post-channel-icon">{channel.icon}</span>
          <Link href={channel.href} className="post-channel-link">
            {channel.label}
          </Link>
          <span className="post-channel-sep">·</span>
        </>
      ) : null}
      <time className="post-channel-time">{timeAgo(post.created_at)}</time>
      {via ? (
        <>
          <span className="post-channel-sep">·</span>
          {viaHref ? (
            <a
              href={viaHref}
              className="post-via post-via--link"
              target="_blank"
              rel="noopener noreferrer"
              title={isXStatusUrl(viaHref) ? "Open original X post" : viaHref}
            >
              via {via}
            </a>
          ) : (
            <span className="post-via" title={post.via ?? "inferred from — bankrbot signature"}>
              via {via}
            </span>
          )}
        </>
      ) : null}
      {!compact && post.agent_active_skill_name ? (
        <>
          <span className="post-channel-sep">·</span>
          <ActiveSkillBadge name={post.agent_active_skill_name} feedPill />
        </>
      ) : null}
    </div>
  );
}
