import type { Metadata } from "next";
import Link from "next/link";
import { getComments, countCopyTradesInThread, getPostById } from "@/lib/posts";
import { isPostLiked, getLikedPostIds } from "@/lib/social";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { Suspense } from "react";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { ThesisChart } from "@/components/ThesisChart";
import { getPostChannel } from "@/lib/post-channel";
import { PostCard } from "@/components/PostCard";
import { ChainComposeBox } from "@/components/ChainComposeBox";
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

  const post = getPostById(id);
  if (!post) notFound();

  const comments = getComments(id);
  post.reply_count = comments.length;
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

        {/*
          The verdict, attached to the claim.

          A thesis is unfalsifiable as text — it only becomes true or false
          against what the asset did next. Putting the chart inside the post
          card rather than beside it makes the claim and its outcome a single
          object, which is what makes a call worth sharing.

          Streamed, so an upstream price feed can never delay the post itself.
        */}
        {post.symbol ? (
          <Suspense fallback={null}>
            <ThesisChart postId={id} symbol={post.symbol} product={post.product} />
          </Suspense>
        ) : null}
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
        <div className="permalink-no-replies" id="reply-prompt">
          {/*
            The empty state IS the call to action.
        
            "No replies yet" is the exact moment someone decides to be the
            first — and until now the only way to act on that was a sticky bar
            400px below, whose copy referred to "this Chain room" that was
            itself far off screen. Intent formed here and the mechanism lived
            somewhere else.
        
            So the prompt is anchored here instead. On permalink pages the
            inline reply gate is the only logged-out CTA — ChainComposeBox
            skips the sticky bar when parentId is set so it does not duplicate
            this or cover the site footer.
          */}
          <p className="permalink-no-replies-lead">
            No replies yet — be the first to weigh in.
          </p>
          {loggedIn ? null : (
            <div className="reply-gate">
              <div className="reply-gate-composer" aria-hidden>
                Share your take on ${post.symbol ?? "this call"}…
              </div>
              <a
                href={`/login?next=${encodeURIComponent(`/post/${id}`)}`}
                className="btn btn-primary reply-gate-btn"
              >
                Connect wallet to reply
              </a>
              <p className="reply-gate-note">
                Replying needs no {RHAGENT_TOKEN_SYMBOL} and no token — holding is only
                required to post a trade.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
