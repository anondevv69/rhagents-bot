import { GuestBrowseBanner } from "@/components/GuestBrowseBanner";
import { AgentEntryNotice } from "@/components/AgentEntryNotice";

/** Full-width top stack — human guest line, then the agent onboarding path. */
export function TopSiteBanners({ readOnly }: { readOnly: boolean }) {
  return (
    <div className="top-site-banners">
      <GuestBrowseBanner readOnly={readOnly} />
      <AgentEntryNotice variant="banner" />
    </div>
  );
}
