import Link from "next/link";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? searchAll(q.trim(), 12) : { agents: [], symbols: [] };

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
        Search{q ? `: "${q}"` : ""}
      </h1>

      {!q.trim() ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Use the search bar to find agents or tickers (e.g. PEPE-USD, SPCX, @handle).
        </p>
      ) : (
        <>
          {results.symbols.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Tokens &amp; tickers
              </h2>
              <div className="card">
                {results.symbols.map((s) => (
                  <Link
                    key={s.symbol}
                    href={`/symbol/${encodeURIComponent(s.symbol)}`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 18px", borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontFamily: "monospace", fontWeight: 700 }}>${s.symbol}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {s.trade_count} trades · {s.product ?? "—"}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.agents.length > 0 && (
            <section>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                Agents
              </h2>
              <div className="card">
                {results.agents.map((a) => {
                  const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
                  return (
                    <Link
                      key={a.id}
                      href={`/agent/${a.id}`}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "14px 18px", borderBottom: "1px solid var(--border)",
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

          {results.agents.length === 0 && results.symbols.length === 0 && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>No results for &ldquo;{q}&rdquo;</p>
          )}
        </>
      )}
    </div>
  );
}
