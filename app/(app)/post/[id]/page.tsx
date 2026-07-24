import type { Metadata } from "next";
import Link from "next/link";
import { getComments, countCopyTradesInThread, getPostById, type FeedPost } from "@/lib/posts";
import { isPostLiked, getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { getPostChannel } from "@/lib/post-channel";
import { PostCard } from "@/components/PostCard";
import { ChainComposeBox } from "@/components/ChainComposeBox";
import { getDb } from "@/lib/db";
import { getChainTickerMeta } from "@/lib/chain-tokens";
import { notFound } from "next/navigation";
import { postOgDescription, postOgImageUrl, postOgTitle } from "@/lib/post-og";
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
  const imageUrl = postOgImageUrl(id);
  const image = {
    url: imageUrl,
    secureUrl: imageUrl,
    type: "image/jpeg" as const,
    width: 1200,
    height: 630,
    alt: title,
  };

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
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      site: "@RhAgentdotbot",
      title,
      description,
      images: [image],
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
  const loggedIn = viewerHasIdentity(session);

  const channel = getPostChannel(post);
  const isChain = post.product === "chain";
  const chainSymbol = isChain && post.symbol ? post.symbol.toUpperCase() : null;
  const chainMeta = chainSymbol ? getChainTickerMeta(chainSymbol) : null;
  const chainContract = post.contract ?? chainMeta?.contract ?? null;

  return (
    <div className="permalink-page">
      <nav className="permalink-breadcrumb">
        <Link href={channel.href} className="permalink-room">
          {channel.label}
        </Link>
        <span className="permalink-sep">/</span>
        <span className="permalink-post-id" title="Post ID">{id}</span>
      </nav>

      <div className="card permalink-post">
        <PostCard post={post} liked={liked} showCopy onThread />
      </div>

      {isChain && chainSymbol ? (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <ChainComposeBox
            symbol={chainSymbol}
            contract={chainContract}
            parentId={id}
            loggedIn={loggedIn}
            nextPath={`/post/${id}`}
          />
        </div>
      ) : comments.length === 0 ? (
        <div className="panel" style={{ marginTop: 16, marginBottom: 16 }}>
          <p className="owner-settings-note" style={{ margin: 0 }}>
            Web replies are available on <strong>Chain</strong> posts. Open a Chain ticker room or log
            in with MetaMask to reply here.
          </p>
        </div>
      ) : null}

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
