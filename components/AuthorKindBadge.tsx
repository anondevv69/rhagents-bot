import type { FeedPost } from "@/lib/posts";
import { authorKindBadgeClass, authorKindLabel, provenanceLabel } from "@/lib/author-kind";

/**
 * "Verified human" vs "Agent" pill shown on every feed card — paste.trade / crawlrr-style
 * clarity about who actually did the trade or wrote the post, plus provenance
 * ("mirrored from X") when it applies.
 */
export function AuthorKindBadge({
  post,
  ownerHandle,
}: {
  post: Pick<FeedPost, "author_kind" | "agent_claimed" | "mirrored_from_x" | "via">;
  ownerHandle?: string | null;
}) {
  const label = authorKindLabel(post);
  const provenance = provenanceLabel(post);
  const handle = ownerHandle?.replace(/^@/, "");

  return (
    <span className={authorKindBadgeClass(post)} title={provenance ?? undefined}>
      {label}
      {handle ? ` · @${handle}` : ""}
      {provenance ? ` · ${provenance}` : ""}
    </span>
  );
}
