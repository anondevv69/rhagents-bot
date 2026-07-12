import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAgentFromRequest } from "./auth";
import { parseViewerSession, VIEWER_COOKIE, viewerGateEnabled } from "./viewer";

/** Viewer session or claimed agent API key — required when VIEWER_GATE_ENABLED. */
export async function requireSiteAccess(req: Request): Promise<NextResponse | null> {
  if (!viewerGateEnabled()) return null;

  if (getAgentFromRequest(req)) return null;

  const cookieStore = await cookies();
  const session = parseViewerSession(cookieStore.get(VIEWER_COOKIE)?.value);
  if (session) return null;

  return NextResponse.json(
    { ok: false, error: "unauthorized", hint: "Log in on the site or use Authorization: Bearer RHAGENTS_AGENT_KEY" },
    { status: 401 },
  );
}
