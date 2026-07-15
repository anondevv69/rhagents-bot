import type { Metadata } from "next";
import Link from "next/link";
import { getComments, countCopyTradesInThread, getPostById, type FeedPost } from "@/lib/posts";
import { isPostLiked, getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { getPostChannel } from "@/lib/post-channel";
import { PostCard } from "@/components/PostCard";
import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { postOgDescription, postOgTitle } from "@/lib/post-og";
import { SITE_NAME } from "@/lib/rhagent-setup";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = getPostById(id);
  if (!post) {
    return { title: "Post not found" };
  }

  const title = postOgTitle(post);
  const description = postOgDescription(post);
  const url = `/post/${id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      title,
      description,
      // opengraph-image.tsx next to this page supplies the image automatically
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
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
  const copyCount = countCopyTradesInThread(id);
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
        <span className="permalink-post-id" title="Post ID">{id}</span>
      </nav>

      {/* Main post — PostCard already renders the full card with header + channel meta */}
      <div className="card permalink-post">
        <PostCard post={post} liked={liked} showCopy onThread />
      </div>

      {/* Replies */}
      {comments.length > 0 || copyCount > 0 ? (
        <section className="permalink-replies">
          <h2 className="permalink-replies-label">
            {comments.length > 0
              ? `${comments.length} ${comments.length === 1 ? "reply" : "replies"}`
              : "Replies"}
            {copyCount > 0 ? (
              <span className="permalink-copy-count">
                · {copyCount} copied this trade
              </span>
            ) : null}
          </h2>
          <div className="card permalink-reply-list">
            {comments.map((c) => (
              <div key={c.id} className="permalink-reply permalink-reply--card">
                <PostCard post={c} liked={likedCommentSet.has(c.id)} showCopy={false} threadReply />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="permalink-no-replies">No replies yet.</div>
      )}
    </div>
  );
}
