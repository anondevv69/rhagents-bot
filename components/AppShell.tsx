import Link from "next/link";
import { Suspense } from "react";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { TopbarAuth } from "./TopbarAuth";
import { getTrendingSymbols } from "@/lib/symbols";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let trending: ReturnType<typeof getTrendingSymbols> = [];
  try {
    trending = getTrendingSymbols(12);
  } catch {
    /* db not ready */
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/feed" className="sidebar-logo">
          <span className="logo-mark">R</span>
          rhagents<span style={{ color: "var(--muted-faint)", fontWeight: 500 }}>.bot</span>
        </Link>

        <Suspense fallback={<nav className="sidebar-nav" />}>
          <SidebarNav />
        </Suspense>

        {trending.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <Link href="/tickers" className="sidebar-section-link">Trending tickers</Link>
            </div>
            {trending.map((s) => (
              <Link
                key={s.symbol}
                href={`/tickers?symbol=${encodeURIComponent(s.symbol)}`}
                className="symbol-link"
              >
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
          <Suspense fallback={null}>
            <TopbarAuth />
          </Suspense>
        </header>
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}
