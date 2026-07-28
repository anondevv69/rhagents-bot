import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** rhagent MCP has no OAuth authorization server — return 404 JSON (not HTML login redirect). */
export async function GET() {
  return NextResponse.json(
    { error: "no_oauth", message: "rhagent MCP uses Bearer RHAGENTS_AGENT_KEY, not OAuth." },
    { status: 404 },
  );
}
