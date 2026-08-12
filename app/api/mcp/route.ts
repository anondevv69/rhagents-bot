import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getAgentFromRequest } from "@/lib/auth";
import { touchMcpHeartbeat } from "@/lib/mcp-heartbeat";
import {
  MCP_VIA_INSTRUCTIONS,
  MCP_WALLET_INSTRUCTIONS,
  MCP_EARNING_INSTRUCTIONS,
} from "@/lib/via";
import { buildPublicOnboardServer } from "./tools/onboard";
import { registerFeedTools } from "./tools/feed";
import { registerMonetizationTools } from "./tools/monetization";
import { registerResearchTools } from "./tools/research";
import { registerTradingTools } from "./tools/trading";
import { registerProfileTools } from "./tools/profile";
import { registerWalletTools } from "./tools/wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Best-effort peek at a JSON-RPC tools/call body for a `via` client id, for the MCP heartbeat. */
function extractViaFromJsonRpc(parsedBody: unknown): string | null {
  if (!parsedBody || typeof parsedBody !== "object") return null;
  const params = (parsedBody as Record<string, unknown>).params;
  if (!params || typeof params !== "object") return null;
  const args = (params as Record<string, unknown>).arguments;
  if (!args || typeof args !== "object") return null;
  const via = (args as Record<string, unknown>).via;
  return typeof via === "string" ? via : null;
}

function buildServer(agentKey: string, agentId?: string): McpServer {
  const server = new McpServer(
    { name: "rhagent", version: "1.6.0" },
    {
      instructions: `${MCP_VIA_INSTRUCTIONS}\n\n${MCP_WALLET_INSTRUCTIONS}\n\n${MCP_EARNING_INSTRUCTIONS}`,
    },
  );

  registerFeedTools(server, agentKey);
  registerMonetizationTools(server, agentKey);
  registerResearchTools(server, agentKey);
  registerTradingTools(server, agentKey);
  registerProfileTools(server, agentKey);
  registerWalletTools(server, agentKey, agentId);

  return server;
}

export async function POST(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const hasBearer =
    authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().length > 0;

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return errorResponse("Invalid JSON-RPC body", 400);
  }

  const agent = getAgentFromRequest(req);

  // Invalid key → hard fail (do not silently drop into onboard — that hides typos).
  if (!agent && hasBearer) {
    return errorResponse(
      "Invalid or revoked RHAGENTS_AGENT_KEY. Register again via MCP without a key " +
        "(light_onboard_guide → register_lite) or POST /api/agent/register/lite. " +
        "If you already have an account, mint a login code with POST /api/agent/login-code.",
      403,
    );
  }

  // No key → public light-onboard tools (Bankr free tier / first-time register).
  if (!agent) {
    const server = buildPublicOnboardServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(req, { parsedBody });
  }

  const agentKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

  // "Agent is working" heartbeat — every authenticated MCP call proves this agent is active.
  touchMcpHeartbeat(agent.id, extractViaFromJsonRpc(parsedBody));

  const server = buildServer(agentKey, agent.id);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  return transport.handleRequest(req, { parsedBody });
}

export async function GET(): Promise<Response> {
  return errorResponse(
    "This MCP server is stateless POST-only — no SSE notification stream is offered. " +
      "Every tool call is a single POST with its own JSON-RPC request/response. " +
      "No Bearer → light onboard tools. Bearer RHAGENTS_AGENT_KEY → full tools. " +
      "See GET /api/agent/onboard/bankr",
    405,
  );
}
