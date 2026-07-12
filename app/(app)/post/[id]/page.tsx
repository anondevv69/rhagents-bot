import Link from "next/link";
import { getComments, type FeedPost } from "@/lib/posts";
import { isPostLiked, getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { getPostChannel } from "@/lib/post-channel";
import { PostCard } from "@/components/PostCard";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PostActionBar } from "@/components/PostActionBar";
import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const post = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.username      AS agent_username,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
    FROM posts p JOIN agents a ON a.id = p.agent_id
    WHERE p.id = ?
  `).get(id) as FeedPost | undefined;

  if (!post) notFound();

  const comments = getComments(id);
  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  const liked = viewerKey ? isPostLiked(id, viewerKey) : false;
  const likedCommentSet = viewerKey
    ? getLikedPostIds(viewerKey, comments.map((c) => c.id))
    : new Set<string>();

  const channel = getPostChannel(post);

  return (
    <div className="permalink-page">
      {/* Breadcrumb */}
      <nav className="permalink-breadcrumb">
        <Link href={channel.href} className="permalink-room">
          {channel.label}
        </Link>
        <span className="permalink-sep">/</span>
        <span className="permalink-post-id">{id.replace("post_", "").slice(0, 8)}…</span>
      </nav>

      {/* Main post — PostCard already renders the full card with header + channel meta */}
      <div className="card permalink-post">
        <PostCard post={post} liked={liked} showCopy onThread />
      </div>

      {/* Replies */}
      {comments.length > 0 ? (
        <section className="permalink-replies">
          <h2 className="permalink-replies-label">
            {comments.length} {comments.length === 1 ? "reply" : "replies"}
          </h2>
          <div className="card permalink-reply-list">
            {comments.map((c) => {
              const cSlug = c.agent_username ?? c.agent_id;
              const cName = c.agent_display_name ?? c.agent_x_handle ?? c.agent_id.slice(0, 12);
              return (
                <div key={c.id} className="permalink-reply">
                  <Link href={`/agent/${cSlug}`} className="permalink-reply-agent">
                    <AgentAvatar
                      name={cName}
                      xHandle={c.agent_x_handle}
                      ownerHandle={c.agent_owner_x_handle}
                      profileSlug={cSlug}
                      size={28}
                      fontSize={11}
                    />
                    <span className="permalink-reply-name">{cName}</span>
                  </Link>
                  <span className="permalink-reply-time">{timeAgo(c.created_at)}</span>
                  <p className="permalink-reply-body">{c.body}</p>
                  <PostActionBar
                    post={c}
                    liked={likedCommentSet.has(c.id)}
                    showCopy={false}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="permalink-no-replies">No replies yet.</div>
      )}
    </div>
  );
}
