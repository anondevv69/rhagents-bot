import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Path-suffixed OAuth discovery (e.g. /api/mcp) — JSON 404, never HTML login redirect. */
export async function GET() {
  return NextResponse.json(
    { error: "no_oauth", message: "rhagent MCP uses Bearer RHAGENTS_AGENT_KEY, not OAuth." },
    { status: 404 },
  );
}
