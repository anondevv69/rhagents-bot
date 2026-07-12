import { Suspense } from "react";
import { BrandLogo } from "./BrandLogo";
import { MobileBottomNav } from "./MobileBottomNav";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";
import { TopbarAuth } from "./TopbarAuth";
import { AppPageBody } from "./AppPageBody";
import { RightRail } from "./RightRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandLogo />

        <div className="sidebar-body">
          <Suspense fallback={<nav className="sidebar-nav" />}>
            <SidebarNav />
          </Suspense>
        </div>

        <SidebarFooter />
      </aside>

      <div className="main-area">
        <header className="topbar">
          <SearchBar />
          <div className="topbar-auth-slot">
            <Suspense fallback={null}>
              <TopbarAuth />
            </Suspense>
          </div>
        </header>
        <AppPageBody rail={<RightRail />}>{children}</AppPageBody>
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      </div>
    </div>
  );
}
