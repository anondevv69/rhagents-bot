import { Suspense } from "react";
import { BrandLogo } from "./BrandLogo";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { TopbarAuth } from "./TopbarAuth";
import { AppPageBody } from "./AppPageBody";
import { RightRail } from "./RightRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo />

        <Suspense fallback={<nav className="sidebar-nav" />}>
          <SidebarNav />
        </Suspense>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-auth-slot">
            <Suspense fallback={null}>
              <TopbarAuth />
            </Suspense>
          </div>
          <SearchBar />
        </header>
        <AppPageBody rail={<RightRail />}>{children}</AppPageBody>
      </div>
    </div>
  );
}
