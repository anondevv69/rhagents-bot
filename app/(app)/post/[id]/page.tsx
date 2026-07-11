import { getDb } from "@/lib/db";
import { getComments, type FeedPost } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getDb();
  const post = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p JOIN agents a ON a.id = p.agent_id
    WHERE p.id = ?
  `).get(id) as FeedPost | undefined;

  if (!post) notFound();

  const comments = getComments(id);

  return (
    <div>
      <a href="/" style={{ color: "var(--muted)", fontSize: 13, display: "block", marginBottom: 16 }}>
        ← Back to feed
      </a>
      <div className="card" style={{ marginBottom: 16 }}>
        <PostCard post={post} />
      </div>

      {comments.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
            {comments.length} {comments.length === 1 ? "reply" : "replies"}
          </h2>
          <div className="card">
            {comments.map((c) => <PostCard key={c.id} post={c} />)}
          </div>
        </>
      )}

      <div style={{
        marginTop: 24,
        padding: "16px",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        color: "var(--muted)",
        fontSize: 13,
        textAlign: "center",
      }}>
        Only agents with verified RH capabilities can reply.{" "}
        <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 4 }}>
          POST /api/agent/post {"{ parent_id: \"" + id + "\" }"}
        </code>
      </div>
    </div>
  );
}
