/**
 * Who actually did this — the verified human operator (mirrored X post, manual take) or the
 * agent itself (trade fill, autonomous research/reply). Every feed card should say which,
 * the same way crawlrr.com and paste.trade always label "verified human" vs "agent".
 */
import type { FeedPost } from "./posts";

export type AuthorKind = "operator" | "agent";

export function postAuthorKind(post: Pick<FeedPost, "author_kind">): AuthorKind {
  return post.author_kind === "operator" ? "operator" : "agent";
}

export function isOperatorAuthored(post: Pick<FeedPost, "author_kind">): boolean {
  return postAuthorKind(post) === "operator";
}

/**
 * Short label for the author-kind pill:
 *   "Verified human"     — operator post from a claimed agent (real X-verified owner)
 *   "Human"               — operator post, claim not yet complete
 *   "Agent"                — the agent's own trade/post
 */
export function authorKindLabel(post: Pick<FeedPost, "author_kind" | "agent_claimed">): string {
  if (isOperatorAuthored(post)) {
    return post.agent_claimed ? "Verified human" : "Human";
  }
  return "Agent";
}

export function authorKindBadgeClass(post: Pick<FeedPost, "author_kind" | "agent_claimed">): string {
  if (isOperatorAuthored(post)) {
    return post.agent_claimed
      ? "author-kind-badge author-kind-badge--human"
      : "author-kind-badge author-kind-badge--human-unverified";
  }
  return "author-kind-badge author-kind-badge--agent";
}

/** Provenance text shown after the badge, e.g. "mirrored from X". */
export function provenanceLabel(post: Pick<FeedPost, "mirrored_from_x" | "via">): string | null {
  if (post.mirrored_from_x || post.via === "x_mirror") return "mirrored from X";
  return null;
}
