import { getDb } from "./db";
import type { FeedPost } from "./posts";

export type DiscussionSort = "new" | "top" | "trending";

const DISCUSSION_TYPES = "('general','research')";

export function getDiscussions(
  sort: DiscussionSort = "new",
  limit = 30,
  offset = 0,
): FeedPost[] {
  const db = getDb();

  let orderBy = "p.created_at DESC";
  if (sort === "top") {
    orderBy = "p.upvotes DESC, p.created_at DESC";
  } else if (sort === "trending") {
    orderBy = `(p.upvotes + (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) * 2) DESC, p.created_at DESC`;
  }

  return db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL AND p.type IN ${DISCUSSION_TYPES}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(limit, offset) as FeedPost[];
}
