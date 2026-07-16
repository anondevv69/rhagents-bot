import { Suspense } from "react";
import { BrandLogo } from "./BrandLogo";
import { GuestBrowseBanner } from "./GuestBrowseBanner";
import { MobileBottomNavSlot } from "./MobileBottomNavSlot";
import { MobileNavMenu } from "./MobileNavMenu";
import { SearchBar } from "./SearchBar";
import { SidebarNav } from "./SidebarNav";
import { SidebarFooter } from "./SidebarFooter";
import { ThemeToggle } from "./ThemeToggle";
import { TopbarAuth } from "./TopbarAuth";
import { AppPageBody } from "./AppPageBody";
import { RightRail } from "./RightRail";
import { ViewerModeProvider } from "./ViewerModeProvider";

export function AppShell({ children, readOnly = false }: { children: React.ReactNode; readOnly?: boolean }) {
  return (
    <ViewerModeProvider readOnly={readOnly}>
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
          <MobileNavMenu />
          <SearchBar />
          <div className="topbar-auth-slot">
            <ThemeToggle />
            <Suspense fallback={null}>
              <TopbarAuth />
            </Suspense>
          </div>
        </header>
        <GuestBrowseBanner />
        <AppPageBody rail={<RightRail />}>{children}</AppPageBody>
        <Suspense fallback={null}>
          <MobileBottomNavSlot />
        </Suspense>
      </div>
      </div>
    </ViewerModeProvider>
  );
}
