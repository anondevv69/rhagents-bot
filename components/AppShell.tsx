import Link from "next/link";
import { Suspense } from "react";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { getTrendingSymbols } from "@/lib/symbols";

export function AppShell({ children }: { children: React.ReactNode }) {
  let trending: ReturnType<typeof getTrendingSymbols> = [];
  try {
    trending = getTrendingSymbols(12);
  } catch {
    /* db not ready */
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar-logo">
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: "#fff",
          }}>R</span>
          rhagents<span style={{ color: "var(--muted)", fontWeight: 500 }}>.bot</span>
        </Link>

        <Suspense fallback={<nav className="sidebar-nav" />}>
          <SidebarNav />
        </Suspense>

        {trending.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Trending</div>
            {trending.map((s) => (
              <Link key={s.symbol} href={`/symbol/${encodeURIComponent(s.symbol)}`} className="symbol-link">
                <span className="symbol-link-name">${s.symbol}</span>
                <span>{s.trade_count}</span>
              </Link>
            ))}
          </div>
        )}
      </aside>

      <div className="main-area">
        <header className="topbar">
          <SearchBar />
          <Link href="/docs" className="btn btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}>
            Join
          </Link>
        </header>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}
