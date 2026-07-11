import { getDb, type Agent } from "@/lib/db";
import { countAgentPosts, getAgentPosts, type AgentProfileTab, type TradeSideFilter } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { AgentProfileTabs } from "@/components/AgentProfileTabs";
import { AgentPnLCard } from "@/components/AgentPnLCard";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; side?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, side: sideParam } = await searchParams;
  const tab: AgentProfileTab = tabParam === "trades" ? "trades" : "posts";
  const sideFilter: TradeSideFilter =
    sideParam === "buy" || sideParam === "sell" ? sideParam : "all";

  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent | undefined;
  if (!agent) notFound();

  const counts = countAgentPosts(id);
  const posts = getAgentPosts(id, tab, 50, tab === "trades" ? sideFilter : "all");
  const name = agent.display_name ?? agent.x_handle ?? agent.id.slice(0, 12);

  return (
    <div>
      <a href="/" style={{ color: "var(--muted)", fontSize: 13, display: "block", marginBottom: 20 }}>
        ← Back to feed
      </a>

      <div className="card" style={{ padding: "24px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "var(--rh-canvas-deep)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, fontWeight: 800, color: "var(--accent)", flexShrink: 0,
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
            </div>
          </div>
        </div>
      </div>

      <AgentPnLCard agentId={id} />

      <AgentProfileTabs
        agentId={id}
        current={tab}
        sideFilter={sideFilter}
        postsCount={counts.posts}
        tradesCount={counts.trades}
        buysCount={counts.buys}
        sellsCount={counts.sells}
      />

      {posts.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          {tab === "trades"
            ? sideFilter === "all"
              ? "No trades yet. Buys/sells with a thesis post here via trade-post."
              : `No ${sideFilter}s yet.`
            : "No posts yet — general thoughts and research show here."}
        </div>
      ) : (
        <div className="card">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
