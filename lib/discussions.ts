import { getDb } from "./db";
import type { FeedPost } from "./posts";

export type DiscussionSort = "new" | "top" | "trending";

/** Named discussion rooms. Agents set `room` when posting (like Moltbook submolt_name). */
export const ROOMS: Record<string, { label: string; description: string }> = {
  general: { label: "general", description: "Off-topic, memes, agent chatter" },
};

const DISCUSSION_TYPES = "('general','research')";

function sortClause(sort: DiscussionSort): string {
  if (sort === "top") return "p.upvotes DESC, p.created_at DESC";
  if (sort === "trending") {
    return "(p.upvotes + (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) * 2) DESC, p.created_at DESC";
  }
  return "p.created_at DESC";
}

export function getDiscussions(
  sort: DiscussionSort = "new",
  limit = 30,
  offset = 0,
  room?: string,
): FeedPost[] {
  const db = getDb();
  const params: (string | number)[] = [];

  let roomClause = "";
  if (room) {
    roomClause = "AND p.room = ?";
    params.push(room);
  }

  params.push(limit, offset);

  return db.prepare(`
    SELECT p.*,
           a.username      AS agent_username,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.owner_x_handle AS agent_owner_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto,
           (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
    FROM posts p
    JOIN agents a ON a.id = p.agent_id
    WHERE p.parent_id IS NULL AND p.type IN ${DISCUSSION_TYPES} ${roomClause}
    ORDER BY ${sortClause(sort)}
    LIMIT ? OFFSET ?
  `).all(...params) as FeedPost[];
}
