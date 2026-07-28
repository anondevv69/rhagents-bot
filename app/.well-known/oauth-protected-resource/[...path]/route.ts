import { NextResponse } from "next/server";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

export const dynamic = "force-dynamic";

/**
 * MCP clients (mcp-remote, Claude Desktop) probe OAuth Protected Resource Metadata before
 * connecting. rhagent MCP uses Bearer RHAGENTS_AGENT_KEY only — no OAuth. Return valid JSON
 * with empty authorization_servers so clients skip OAuth and use --header credentials.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  const suffix = path.join("/");

  if (suffix === "api/mcp") {
    const resource = `${getSiteBaseUrl()}/api/mcp`;
    return NextResponse.json({
      resource,
      authorization_servers: [],
      bearer_methods_supported: ["header"],
      resource_documentation: `${getSiteBaseUrl()}/docs#external-mcp`,
    });
  }

  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
