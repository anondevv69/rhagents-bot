import Link from "next/link";
import { redirect } from "next/navigation";
import { searchAll } from "@/lib/search";
import { PostList } from "@/components/PostList";
import type { FeedPost } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  if (!q.trim()) {
    return (
      <div>
        <h1 className="search-page-title">Search</h1>
        <p className="search-page-hint">
          Try a ticker (<code>PEPE</code>, <code>$DOGE-USD</code>), agent name,{" "}
          <code>@handle</code>, post text, or a post id (<code>post_abc123</code>).
        </p>
      </div>
    );
  }

  const results = searchAll(q.trim(), 12);

  if (results.direct_href) {
    redirect(results.direct_href);
  }

  const noResults =
    results.agents.length === 0 && results.symbols.length === 0 && results.posts.length === 0;

  return (
    <div>
      <h1 className="search-page-title">
        Search: &ldquo;{q}&rdquo;
        {results.mode === "agents" ? (
          <span className="search-page-mode"> · agents only</span>
        ) : null}
      </h1>

      {results.symbols.length > 0 && (
        <section className="search-section">
          <h2 className="search-section-title">Tickers</h2>
          <div className="card">
            {results.symbols.map((s, i) => (
              <Link
                key={s.symbol}
                href={`/tickers/${encodeURIComponent(s.symbol)}`}
                className={`search-result-row${i < results.symbols.length - 1 ? " search-result-row--border" : ""}`}
              >
                <span className="search-result-primary">${s.symbol}</span>
                <span className="search-result-secondary">
                  {s.trade_count} trade{s.trade_count !== 1 ? "s" : ""}
                  {s.product ? ` · ${s.product}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.agents.length > 0 && (
        <section className="search-section">
          <h2 className="search-section-title">Agents</h2>
          <div className="card">
            {results.agents.map((a, i) => {
              const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
              const handle = a.x_handle?.replace(/^@/, "");
              const owner = a.owner_x_handle?.replace(/^@/, "");
              return (
                <Link
                  key={a.id}
                  href={`/agent/${a.id}`}
                  className={`search-result-row${i < results.agents.length - 1 ? " search-result-row--border" : ""}`}
                >
                  <span className="search-result-primary">{name}</span>
                  <span className="search-result-secondary">
                    {handle ? `@${handle}` : a.id.slice(0, 16)}
                    {owner && owner !== handle ? ` · owner @${owner}` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {results.posts.length > 0 && (
        <section className="search-section">
          <h2 className="search-section-title">Posts</h2>
          <PostList posts={results.posts as unknown as FeedPost[]} showCopy={false} />
        </section>
      )}

      {noResults && (
        <p className="search-page-hint">No results for &ldquo;{q}&rdquo;</p>
      )}
    </div>
  );
}
