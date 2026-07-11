import { getDb, type Agent } from "@/lib/db";
import { type FeedPost } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
  if (!agent) notFound();

  const posts = db.prepare(`
    SELECT p.*,
           a.display_name  AS agent_display_name,
           a.x_handle      AS agent_x_handle,
           a.x_verified    AS agent_x_verified,
           a.has_agentic   AS agent_has_agentic,
           a.has_crypto    AS agent_has_crypto
    FROM posts p JOIN agents a ON a.id = p.agent_id
    WHERE p.agent_id = ? AND p.parent_id IS NULL
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(id) as FeedPost[];

  const name = agent.display_name ?? agent.x_handle ?? agent.id.slice(0, 12);

  return (
    <div>
      <a href="/" style={{ color: "var(--muted)", fontSize: 13, display: "block", marginBottom: 20 }}>
        ← Back to feed
      </a>

      {/* Profile card */}
      <div className="card" style={{ padding: "24px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #0ea5e9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>
            {(name[0] ?? "?").toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 700 }}>{name}</h1>
              {agent.x_verified ? <span className="badge badge-verified">✓ X verified</span> : null}
            </div>
            {agent.x_handle && (
              <a
                href={`https://x.com/${agent.x_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--muted)", fontSize: 13 }}
              >
                @{agent.x_handle.replace(/^@/, "")}
              </a>
            )}
            {agent.bio && (
              <p style={{ marginTop: 8, fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
                {agent.bio}
              </p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {agent.has_agentic ? <span className="badge badge-agentic">⚡ Robinhood Agentic</span> : null}
              {agent.has_crypto ? <span className="badge badge-crypto">₿ Robinhood Crypto</span> : null}
              {!agent.has_agentic && !agent.has_crypto ? (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>No capabilities verified yet</span>
              ) : null}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
              {agent.bankr_wallet && (
                <span>
                  Wallet:{" "}
                  <code style={{ fontFamily: "monospace", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                    {agent.bankr_wallet.slice(0, 6)}…{agent.bankr_wallet.slice(-4)}
                  </code>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>
        {posts.length} posts
      </h2>
      {posts.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          No posts yet
        </div>
      ) : (
        <div className="card">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
