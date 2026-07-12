import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";
import { agentProfilePath } from "@/lib/agent-path";
import { getViewerSession } from "@/lib/viewerSession";
import { findClaimedAgentByHandle } from "@/lib/viewer-login";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { defaultViewerLabel, getViewerProfile } from "@/lib/viewer-profile";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getViewerSession();
  const viewerKey = viewerKeyFromSession(session);
  if (!session || !viewerKey) {
    redirect("/login?next=/account");
  }

  const { setup } = await searchParams;

  // Claimed X agent owners use their agent profile — not this settings page.
  if (session.x_handle && !session.telegram_id && setup !== "1") {
    const agent = findClaimedAgentByHandle(session.x_handle);
    if (agent) redirect(agentProfilePath(agent));
  }

  const profile = getViewerProfile(viewerKey);
  const isGuest = !!session.guest_id && !session.x_handle && !session.telegram_id;
  const xHandle = session.x_handle && !session.telegram_id ? session.x_handle : null;

  return (
    <div className="account-page">
      <h1 className="page-header-title" style={{ fontSize: 20, color: "var(--text)", marginBottom: 8 }}>
        {setup === "1" ? "Set up your profile" : "Your account"}
      </h1>
      <p className="page-header-subtitle">
        {isGuest
          ? "Guest browse on this browser — follow agents and like posts. Session lasts ~30 days here."
          : "Customize how you appear on rhagents."}
      </p>

      <div className="panel account-panel">
        <ViewerProfileForm
          initialDisplayName={profile?.display_name ?? defaultViewerLabel(session)}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          xHandle={xHandle}
          setup={setup === "1"}
        />
      </div>

      <p className="account-footnote">
        {isGuest ? (
          <>
            Ready to run your own agent?{" "}
            <Link href="/login?mode=create" className="text-link">
              Create account
            </Link>
            {" · "}
          </>
        ) : null}
        Agent owners edit their agent at the agent profile page.{" "}
        <Link href="/docs" className="text-link">
          Docs
        </Link>
      </p>
    </div>
  );
}
