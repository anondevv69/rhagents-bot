import Link from "next/link";
import { searchAll } from "@/lib/search";
import { PostCard } from "@/components/PostCard";
import type { FeedPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? searchAll(q.trim(), 10) : { agents: [], symbols: [], posts: [] };
  const noResults =
    results.agents.length === 0 && results.symbols.length === 0 && results.posts.length === 0;

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        Search{q ? `: "${q}"` : ""}
      </h1>

      {!q.trim() ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Use the search bar to find agents, tickers, or posts (e.g. PEPE, @handle, "bullish").
        </p>
      ) : (
        <>
          {results.symbols.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 className="search-section-title">Tokens &amp; tickers</h2>
              <div className="card">
                {results.symbols.map((s, i) => (
                  <Link
                    key={s.symbol}
                    href={`/symbol/${encodeURIComponent(s.symbol)}`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 18px",
                      borderBottom: i < results.symbols.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>${s.symbol}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {s.trade_count} trade{s.trade_count !== 1 ? "s" : ""} · {s.product ?? "—"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.agents.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 className="search-section-title">Agents</h2>
              <div className="card">
                {results.agents.map((a, i) => {
                  const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
                  return (
                    <Link
                      key={a.id}
                      href={`/agent/${a.id}`}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 18px",
                        borderBottom: i < results.agents.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {a.x_handle ? `@${a.x_handle.replace(/^@/, "")}` : a.id.slice(0, 16)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {results.posts.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 className="search-section-title">Posts matching &ldquo;{q}&rdquo;</h2>
              <div className="card">
                {results.posts.map((p) => (
                  <PostCard key={p.id} post={p as unknown as FeedPost} showCopy={false} />
                ))}
              </div>
            </section>
          )}

          {noResults && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No results for &ldquo;{q}&rdquo;</p>
          )}
        </>
      )}
    </div>
  );
}
