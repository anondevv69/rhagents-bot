import Link from "next/link";
import type { FeedPost } from "@/lib/posts";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import {
  iaAgentName,
  iaBadgeClass,
  iaInitials,
  iaPostBadges,
  iaPostSnippet,
  iaPostTitle,
  iaTimeAgo,
  iaVoteScore,
} from "@/lib/ia-concept-format";

export function IaConceptFeedCard({
  post,
  profileHref,
  discussion = false,
}: {
  post: FeedPost;
  profileHref?: (username: string) => string;
  discussion?: boolean;
}) {
  const name = iaAgentName(post);
  const slug = post.agent_username ?? post.agent_id;
  const badges = iaPostBadges(post);
  const title = iaPostTitle(post);
  const snippet = iaPostSnippet(post);
  const side = post.side;
  const symbol = post.symbol;

  return (
    <article className="ia-concept-card">
      <div className="ia-concept-vote-row">
        <div className="ia-concept-vote" aria-hidden>
          <span className="ia-concept-vote-arrow">▲</span>
          {iaVoteScore(post)}
          <span className="ia-concept-vote-arrow">▼</span>
        </div>
        <div className="ia-concept-card-body">
          <div className="ia-concept-card-meta">
            <span className="ia-concept-mini-avatar">{iaInitials(name)}</span>
            {profileHref ? (
              <Link href={profileHref(slug)} className="ia-concept-agent-link">
                <b>{name}</b>
              </Link>
            ) : (
              <Link href={`/agent/${slug}`} className="ia-concept-agent-link">
                <b>{name}</b>
              </Link>
            )}
            {badges.map((b) => (
              <span key={b} className={iaBadgeClass(b)}>
                {b}
              </span>
            ))}
            {post.agent_active_skill_name ? (
              <>
                <span className="ia-concept-meta-sep">·</span>
                <ActiveSkillBadge name={post.agent_active_skill_name} />
              </>
            ) : null}
            {symbol && side && !discussion ? (
              <span className={side === "sell" ? "ia-concept-tag-sell" : "ia-concept-tag-buy"}>
                {side.toUpperCase()} · {symbol}
              </span>
            ) : null}
            <span className="ia-concept-meta-sep">·</span>
            <time>{iaTimeAgo(post.created_at)}</time>
          </div>
          <Link href={`/post/${post.id}`} className="ia-concept-card-title">
            {title}
          </Link>
          {snippet ? <p className="ia-concept-card-snippet">{snippet}</p> : null}
          <div className="ia-concept-card-actions">
            <Link href={`/post/${post.id}`}>💬 {post.reply_count ?? 0} comments</Link>
            <Link href={`/post/${post.id}`}>open thread</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
