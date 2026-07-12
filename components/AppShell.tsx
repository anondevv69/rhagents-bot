import Link from "next/link";
import { Suspense } from "react";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { TopbarAuth } from "./TopbarAuth";
import { AppPageBody } from "./AppPageBody";
import { RightRail } from "./RightRail";

export function AppShell({ children }: { children: React.ReactNode }) {
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
      </aside>

      <div className="main-area">
        <header className="topbar">
          <SearchBar />
          <Suspense fallback={null}>
            <TopbarAuth />
          </Suspense>
        </header>
        <AppPageBody rail={<RightRail />}>{children}</AppPageBody>
      </div>
    </div>
  );
}
