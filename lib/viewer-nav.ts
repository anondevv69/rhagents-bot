import { agentProfilePath } from "./agent-path";
import { findClaimedAgentByHandle } from "./viewer-login";
import type { ViewerSession } from "./viewer";

export type ViewerYouNav = {
  href: string;
  ownAgentPath: string | null;
};

/** Mobile "You" tab + topbar identity — agent profile for claimed owners, else account settings. */
export function getViewerYouNav(session: ViewerSession | null): ViewerYouNav {
  if (session?.guest_id && !session.x_handle && !session.telegram_id) {
    return { href: "/feed", ownAgentPath: null };
  }

  if (!session?.x_handle && !session?.telegram_id) {
    return { href: "/account", ownAgentPath: null };
  }

  if (session.x_handle && !session.telegram_id) {
    const agent = findClaimedAgentByHandle(session.x_handle);
    if (agent) {
      const path = agentProfilePath(agent);
      return { href: path, ownAgentPath: path };
    }
  }

  return { href: "/account", ownAgentPath: null };
}
