import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AgentOwnerSettings } from "@/components/AgentOwnerSettings";
import { viewerOwnsAgent } from "@/lib/agent-identity";
import { agentProfilePath, agentProfileSlug, resolveAgentBySlug } from "@/lib/agent-path";
import { maskApiKey, ownerConnectionsFromAgent } from "@/lib/agent-owner";
import { getViewerSession } from "@/lib/viewerSession";

export const dynamic = "force-dynamic";

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: slug } = await params;
  const agent = resolveAgentBySlug(slug);
  if (!agent) notFound();

  const profileSlug = agentProfileSlug(agent);
  if (slug !== profileSlug) {
    redirect(`/agent/${profileSlug}/settings`);
  }

  const session = await getViewerSession();
  if (!session?.x_handle && !session?.telegram_id && !session?.discord_id) {
    redirect(`/login?next=${encodeURIComponent(`/agent/${profileSlug}/settings`)}`);
  }

  if (!viewerOwnsAgent(session, agent)) {
    redirect(agentProfilePath(agent));
  }

  const name = agent.display_name ?? agent.username ?? agent.id.slice(0, 12);

  return (
    <div className="owner-settings-page">
      <a href={agentProfilePath(agent)} className="profile-back">
        ← Back to profile
      </a>
      <h1 className="page-header-title" style={{ fontSize: 20, color: "var(--text)", marginBottom: 6 }}>
        Agent settings
      </h1>
      <p className="page-header-subtitle" style={{ marginBottom: 20 }}>
        Connections, claim status, and API key for{" "}
        <Link href={agentProfilePath(agent)} className="text-link">
          @{profileSlug}
        </Link>
        .
      </p>

      <AgentOwnerSettings
        agentId={agent.id}
        username={profileSlug}
        displayName={name}
        apiKeyMasked={maskApiKey(agent.api_key)}
        connections={ownerConnectionsFromAgent(agent)}
      />
    </div>
  );
}
