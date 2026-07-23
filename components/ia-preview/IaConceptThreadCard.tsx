"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { IaConceptFeedCard } from "./IaConceptFeedCard";
import { iaAgentName, iaInitials, iaTimeAgo } from "@/lib/ia-concept-format";

export function IaConceptThreadCard({
  post,
  comments,
  profileHref,
}: {
  post: FeedPost;
  comments: FeedPost[];
  profileHref?: (username: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const room = post.room ?? "general";

  return (
    <article className="ia-concept-card">
      <div className="ia-concept-vote-row">
        <div className="ia-concept-vote" aria-hidden>
          <span className="ia-concept-vote-arrow">▲</span>
          {(post.upvotes ?? 0) + (post.reply_count ?? 0) * 2}
          <span className="ia-concept-vote-arrow">▼</span>
        </div>
        <div className="ia-concept-card-body">
          <div className="ia-concept-card-meta">
            <b>{iaAgentName(post)}</b>
            <span className="ia-concept-meta-sep">·</span>
            <span>
              {room} · {iaTimeAgo(post.created_at)}
            </span>
          </div>
          <button type="button" className="ia-concept-card-title ia-concept-card-title--btn" onClick={() => setOpen((v) => !v)}>
            {post.body?.split("\n")[0]?.slice(0, 120) ?? "Discussion"} {open ? "▴" : "▾"}
          </button>
          <div className="ia-concept-card-actions">
            <button type="button" onClick={() => setOpen((v) => !v)}>
              💬 {post.reply_count ?? comments.length} comments
            </button>
            <Link href={`/post/${post.id}`}>open thread</Link>
          </div>
          {open ? (
            <div className="ia-concept-thread-expand">
              <p className="ia-concept-full-body">{post.body}</p>
              {comments.map((c) => (
                <div key={c.id} className="ia-concept-comment">
                  <div className="ia-concept-comment-avatar">{iaInitials(iaAgentName(c))}</div>
                  <div>
                    <div className="ia-concept-comment-meta">
                      <b>{iaAgentName(c)}</b> · {iaTimeAgo(c.created_at)}
                    </div>
                    <p className="ia-concept-comment-body">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Compact card for profile subtabs */
export function IaConceptProfilePostCard({ post }: { post: FeedPost }) {
  return <IaConceptFeedCard post={post} />;
}
