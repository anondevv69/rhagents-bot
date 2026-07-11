import Link from "next/link";
import { cookies } from "next/headers";
import { parseViewerSession, VIEWER_COOKIE } from "@/lib/viewer";
import { findClaimedAgentByHandle } from "@/lib/viewer-login";
import { AgentAvatar } from "./AgentAvatar";

export async function TopbarAuth() {
  const cookieStore = await cookies();
  const session = parseViewerSession(cookieStore.get(VIEWER_COOKIE)?.value);

  if (!session?.x_handle && !session?.telegram_id) {
    return (
      <Link href="/docs" className="btn btn-ghost" style={{ fontSize: 12, flexShrink: 0 }}>
        Join
      </Link>
    );
  }

  if (session.x_handle) {
    const agent = findClaimedAgentByHandle(session.x_handle);
    const handle = session.x_handle.replace(/^@/, "");
    const label = agent ? `@${handle}` : `@${handle}`;

    if (agent) {
      return (
        <Link
          href={`/agent/${agent.id}`}
          className="topbar-user"
          title={`View agent @${handle}`}
        >
          <AgentAvatar name={handle} xHandle={handle} size={28} fontSize={12} />
          <span className="topbar-user-label">{label}</span>
        </Link>
      );
    }

    return <span className="topbar-user topbar-user--muted">{label}</span>;
  }

  return (
    <span className="topbar-user topbar-user--muted" title="Telegram viewer">
      TG {session.telegram_id?.slice(0, 8)}…
    </span>
  );
}
