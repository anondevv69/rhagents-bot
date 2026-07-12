import { getDb } from "./db";

export function syncPostUpvoteCount(postId: string): number {
  const db = getDb();
  const count = db.prepare(`SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?`).get(postId) as { c: number };
  db.prepare(`UPDATE posts SET upvotes = ? WHERE id = ?`).run(count.c, postId);
  return count.c;
}

export function isPostLiked(postId: string, viewerKey: string): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT 1 FROM post_likes WHERE post_id = ? AND viewer_key = ?`).get(postId, viewerKey);
  return !!row;
}

export function togglePostLike(postId: string, viewerKey: string): { liked: boolean; count: number } {
  const db = getDb();
  const existing = db.prepare(`SELECT 1 FROM post_likes WHERE post_id = ? AND viewer_key = ?`).get(postId, viewerKey);

  if (existing) {
    db.prepare(`DELETE FROM post_likes WHERE post_id = ? AND viewer_key = ?`).run(postId, viewerKey);
    return { liked: false, count: syncPostUpvoteCount(postId) };
  }

  db.prepare(`INSERT INTO post_likes (post_id, viewer_key) VALUES (?, ?)`).run(postId, viewerKey);
  return { liked: true, count: syncPostUpvoteCount(postId) };
}

export function isFollowingAgent(agentId: string, viewerKey: string): boolean {
  const db = getDb();
  const row = db.prepare(`SELECT 1 FROM agent_follows WHERE agent_id = ? AND viewer_key = ?`).get(agentId, viewerKey);
  return !!row;
}

export function getFollowerCount(agentId: string): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) AS c FROM agent_follows WHERE agent_id = ?`).get(agentId) as { c: number };
  return row.c;
}

export function toggleAgentFollow(agentId: string, viewerKey: string): { following: boolean; count: number } {
  const db = getDb();
  const existing = db.prepare(`SELECT 1 FROM agent_follows WHERE agent_id = ? AND viewer_key = ?`).get(agentId, viewerKey);

  if (existing) {
    db.prepare(`DELETE FROM agent_follows WHERE agent_id = ? AND viewer_key = ?`).run(agentId, viewerKey);
    return { following: false, count: getFollowerCount(agentId) };
  }

  db.prepare(`INSERT INTO agent_follows (agent_id, viewer_key) VALUES (?, ?)`).run(agentId, viewerKey);
  return { following: true, count: getFollowerCount(agentId) };
}

export function getFollowedAgentIds(viewerKey: string): string[] {
  const db = getDb();
  const rows = db.prepare(`SELECT agent_id FROM agent_follows WHERE viewer_key = ? ORDER BY created_at DESC`).all(viewerKey) as { agent_id: string }[];
  return rows.map((r) => r.agent_id);
}

export function getLikedPostIds(viewerKey: string, postIds: string[]): Set<string> {
  if (postIds.length === 0) return new Set();
  const db = getDb();
  const placeholders = postIds.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT post_id FROM post_likes
    WHERE viewer_key = ? AND post_id IN (${placeholders})
  `).all(viewerKey, ...postIds) as { post_id: string }[];
  return new Set(rows.map((r) => r.post_id));
}
