import { NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { resolveOwnedAgentForViewer } from "@/lib/viewer-agent";

/** GET /api/viewer/session — lightweight auth hint for client buy/copy UI. */
export async function GET() {
  const session = await getViewerSession();
  const loggedIn = viewerHasIdentity(session);
  const agent = loggedIn ? resolveOwnedAgentForViewer(session) : null;
  return NextResponse.json({
    ok: true,
    logged_in: loggedIn,
    chain_wallet: session?.chain_wallet ?? null,
    has_agent: !!agent,
    username: agent?.username ?? null,
  });
}
