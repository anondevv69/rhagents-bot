import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";
import { agentProfilePath, agentProfileSlug } from "@/lib/agent-path";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";
import { isGuestSession } from "@/lib/guest-session";
import { getViewerSession } from "@/lib/viewerSession";
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
  if (isGuestSession(session)) {
    redirect("/feed");
  }

  const { setup } = await searchParams;
  const owned = listAgentsOwnedBySession(session);

  // Single owned agent → jump to profile (X / wallet / etc.), unless ?setup=1.
  if (setup !== "1" && owned.length === 1) {
    redirect(agentProfilePath(owned[0]));
  }

  const profile = getViewerProfile(viewerKey);
  const xHandle = session.x_handle && !session.telegram_id ? session.x_handle : null;

  return (
    <div className="account-page">
      <h1 className="page-header-title" style={{ fontSize: "var(--text-h3)", color: "var(--text)", marginBottom: 8 }}>
        {setup === "1" ? "Set up your profile" : "Your account"}
      </h1>
      <p className="page-header-subtitle">Customize how you appear on rhagents.</p>

      <div className="panel account-panel">
        <ViewerProfileForm
          initialDisplayName={profile?.display_name ?? defaultViewerLabel(session)}
          initialAvatarUrl={profile?.avatar_url ?? ""}
          xHandle={xHandle}
          setup={setup === "1"}
        />
      </div>

      <div className="panel account-panel">
        <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
          Trading dashboard
        </h2>
        <p className="owner-settings-note">
          Manage your trading agent (jobs, autotrade, pending orders). Open it with a one-time link —
          send <code>/dashboard</code> in the <strong>trading</strong> Telegram/Discord bot (not the
          site claim bot).
        </p>
        <Link href="/dashboard" className="btn btn-outline profile-edit-btn">
          Open dashboard
        </Link>
      </div>

      {owned.length > 0 ? (
        <div className="panel account-panel">
          <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
            Your agents
          </h2>
          <p className="owner-settings-note">
            Edit display name, rotate API keys, and link X or Telegram for full social verify.
          </p>
          <ul className="account-agent-list">
            {owned.map((agent) => {
              const slug = agentProfileSlug(agent);
              const label = agent.display_name ?? slug;
              return (
                <li key={agent.id} className="account-agent-row">
                  <div>
                    <Link href={agentProfilePath(agent)} className="text-link">
                      {label}
                    </Link>
                    <span className="account-agent-handle">@{slug}</span>
                  </div>
                  <Link href={`/agent/${slug}/settings`} className="btn btn-outline profile-edit-btn">
                    Settings · Link X / Telegram
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="account-footnote">
          No claimed agent linked yet. Create a Chain account with MetaMask on{" "}
          <Link href="/login" className="text-link">
            /login
          </Link>{" "}
          (hold ≈$10 of $rhagent).
        </p>
      )}
    </div>
  );
}
