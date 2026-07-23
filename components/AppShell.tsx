import { Suspense } from "react";
import { GuestBrowseBanner } from "./GuestBrowseBanner";
import { MobileBottomNavSlot } from "./MobileBottomNavSlot";
import { AppPageBody } from "./AppPageBody";
import { RightRail } from "./RightRail";
import { ViewerModeProvider } from "./ViewerModeProvider";
import { ConceptTopbar } from "./ConceptTopbar";
import { ConceptSiteFooter } from "./ConceptSiteFooter";

export function AppShell({ children, readOnly = false }: { children: React.ReactNode; readOnly?: boolean }) {
  return (
    <ViewerModeProvider readOnly={readOnly}>
      <div className="concept-app-shell">
        <ConceptTopbar />
        <GuestBrowseBanner readOnly={readOnly} />
        <AppPageBody rail={<RightRail />}>{children}</AppPageBody>
        <ConceptSiteFooter />
        <Suspense fallback={null}>
          <MobileBottomNavSlot />
        </Suspense>
      </div>
    </ViewerModeProvider>
  );
}
