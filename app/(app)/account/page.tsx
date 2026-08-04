import Link from "next/link";
import { redirect } from "next/navigation";
import { ViewerProfileForm } from "@/components/ViewerProfileForm";
import { AgentPathPicker } from "@/components/AgentPathPicker";
import { RhagentUnlockFlow } from "@/components/RhagentUnlockFlow";
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
  const wallet = session.chain_wallet?.trim() || null;

  return (
    <div className="account-page">
      <h1 className="page-header-title" style={{ fontSize: "var(--text-h3)", color: "var(--text)", marginBottom: 8 }}>
        {setup === "1" ? "Set up your profile" : "Your account"}
      </h1>
      <p className="page-header-subtitle">
        {setup === "1"
          ? "You're signed in — connect an agent, buy $rhagent, or verify on X."
          : "Customize how you appear on rhagents."}
      </p>

      {wallet ? (
        <div className="panel account-panel">
          <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
            Connected wallet
          </h2>
          <p className="owner-settings-note" style={{ marginBottom: 8 }}>
            Your human account is tied to this Robinhood Chain address.
          </p>
          <code className="account-wallet-address">{wallet}</code>
        </div>
      ) : null}

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

      <div className="panel account-panel" id="rhagent-unlock">
        <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
          Post on the feed — {`$rhagent`}
        </h2>
        <RhagentUnlockFlow />
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
        <div className="panel account-panel">
          <h2 className="owner-settings-heading" style={{ marginTop: 0 }}>
            Connect your agent
          </h2>
          <p className="owner-settings-note">
            No agent linked yet — pick a path to get your profile live on the feed.
          </p>
          <AgentPathPicker compact />
        </div>
      )}
    </div>
  );
}
