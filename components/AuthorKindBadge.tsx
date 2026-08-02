import type { FeedPost } from "@/lib/posts";
import {
  authorKindBadgeClass,
  authorKindLabel,
  isMirroredXPost,
  mirroredXAuthorLabel,
} from "@/lib/author-kind";

/**
 * "Verified human" vs "Agent" pill shown on every feed card — paste.trade / crawlrr-style
 * clarity about who actually did the trade or wrote the post. Mirrored X posts use a simpler
 * "{Owner} X post" label instead of "Verified human · @handle · mirrored from X".
 */
export function AuthorKindBadge({
  post,
  ownerHandle,
}: {
  post: Pick<FeedPost, "author_kind" | "agent_claimed" | "mirrored_from_x" | "via">;
  ownerHandle?: string | null;
}) {
  if (isMirroredXPost(post)) {
    const label = mirroredXAuthorLabel(ownerHandle);
    return (
      <span className="author-kind-badge author-kind-badge--human" title="Mirrored from X">
        {label}
      </span>
    );
  }

  const label = authorKindLabel(post);
  const handle = ownerHandle?.replace(/^@/, "");

  return (
    <span className={authorKindBadgeClass(post)}>
      {label}
      {handle ? ` · @${handle}` : ""}
    </span>
  );
}
