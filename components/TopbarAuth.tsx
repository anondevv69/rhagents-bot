import Link from "next/link";
import { cookies } from "next/headers";
import { parseViewerSession, VIEWER_COOKIE } from "@/lib/viewer";
import { findClaimedAgentByHandle } from "@/lib/viewer-login";
import { defaultViewerLabel, getViewerProfile } from "@/lib/viewer-profile";
import { viewerKeyFromSession } from "@/lib/viewer-key";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "./AgentAvatar";
import { ViewerAvatar } from "./ViewerAvatar";

export async function TopbarAuth() {
  const cookieStore = await cookies();
  const session = parseViewerSession(cookieStore.get(VIEWER_COOKIE)?.value);

  if (!session?.x_handle && !session?.telegram_id && !session?.guest_id) {
    return (
      <Link href="/login?mode=viewer&next=/feed" className="btn btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}>
        Log in
      </Link>
    );
  }

  const viewerKey = viewerKeyFromSession(session);
  const profile = viewerKey ? getViewerProfile(viewerKey) : null;

  if (session.guest_id && !session.x_handle && !session.telegram_id) {
    const displayName = profile?.display_name ?? defaultViewerLabel(session);

    return (
      <Link href="/feed" className="topbar-user" title="Guest browse">
        <ViewerAvatar name={displayName} avatarUrl={profile?.avatar_url} size={28} fontSize={12} />
        <span className="topbar-user-label">{displayName}</span>
      </Link>
    );
  }

  if (session.x_handle && !session.telegram_id) {
    const agent = findClaimedAgentByHandle(session.x_handle);
    const handle = session.x_handle.replace(/^@/, "");
    const label = `@${handle}`;

    if (agent) {
      return (
        <Link
          href={agentProfilePath(agent)}
          className="topbar-user"
          title={`View agent @${handle}`}
        >
          <AgentAvatar name={handle} xHandle={handle} size={28} fontSize={12} />
          <span className="topbar-user-label">{label}</span>
        </Link>
      );
    }

    const displayName = profile?.display_name ?? label;

    return (
      <Link href="/account" className="topbar-user" title="Account settings">
        <ViewerAvatar
          name={displayName}
          avatarUrl={profile?.avatar_url}
          xHandle={handle}
          size={28}
          fontSize={12}
        />
        <span className="topbar-user-label">{displayName}</span>
      </Link>
    );
  }

  const displayName = profile?.display_name ?? defaultViewerLabel(session);

  return (
    <Link href="/account" className="topbar-user" title="Account settings">
      <ViewerAvatar name={displayName} avatarUrl={profile?.avatar_url} size={28} fontSize={12} />
      <span className="topbar-user-label">{displayName}</span>
    </Link>
  );
}
