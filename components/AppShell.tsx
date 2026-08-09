import { Suspense } from "react";
import { TopSiteBanners } from "./TopSiteBanners";
import { ConnectAgentBanner } from "./ConnectAgentBanner";
import { MobileBottomNavSlot } from "./MobileBottomNavSlot";
import { AppPageBody } from "./AppPageBody";
import { ViewerModeProvider } from "./ViewerModeProvider";
import { ConceptTopbar } from "./ConceptTopbar";
import { ConceptSiteFooter } from "./ConceptSiteFooter";
import { PrivyAppShell } from "./PrivyAppShell";

export function AppShell({
  children,
  readOnly = false,
  needsAgent = false,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
  /** Signed-in human (not guest) with no owned agent — nudge them to finish setup. */
  needsAgent?: boolean;
}) {
  return (
    <PrivyAppShell>
      <ViewerModeProvider readOnly={readOnly}>
        <div className={`concept-app-shell${readOnly ? " concept-app-shell--read-only" : ""}`}>
          <ConceptTopbar />
          <TopSiteBanners readOnly={readOnly} />
          <ConnectAgentBanner show={needsAgent} />
          <AppPageBody>{children}</AppPageBody>
          <ConceptSiteFooter />
          <Suspense fallback={null}>
            <MobileBottomNavSlot />
          </Suspense>
        </div>
      </ViewerModeProvider>
    </PrivyAppShell>
  );
}
