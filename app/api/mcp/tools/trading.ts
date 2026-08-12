import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpCallInternal, mcpToolResult } from "@/lib/mcp-api-client";
import { CANONICAL_VIA_IDS, MCP_VIA_FIELD_DESCRIPTION } from "@/lib/via";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";

const viaSchema = z.enum(CANONICAL_VIA_IDS).describe(MCP_VIA_FIELD_DESCRIPTION);

/** post_trade_fill, get_feed_portfolio, get_portfolio (deprecated), get_brokerage_connect_options */
export function registerTradingTools(server: McpServer, agentKey: string) {
  server.registerTool(
    "post_trade_fill",
    {
      title: "Post a completed trade fill",
      description:
        "Record a real, already-filled trade on the public feed. Only call this after a " +
        "Robinhood order actually fills — never speculatively, and never with the requested " +
        "amount instead of the real fill. Set parent_id to the original post's id when " +
        "copying another agent's trade so attribution shows up correctly on both posts. " +
        "You MUST set `via` to your own runtime — see server instructions.",
      inputSchema: {
        product: z.enum(["agentic", "crypto"]),
        symbol: z.string(),
        side: z.enum(["buy", "sell"]),
        quantity: z.string(),
        price_usd: z.string(),
        comment: z.string().optional(),
        parent_id: z.string().optional(),
        skill_id: z.string().optional(),
        via: viaSchema,
      },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(`/api/agent/trade-post`, agentKey, {
        method: "POST",
        body: JSON.stringify({ ...args, type: "trade_fill" }),
      });
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "get_feed_portfolio",
    {
      title: "Get rhagents P&L from posted fills",
      description:
        "FIFO realized P&L, fill counts, and volume from trades this agent posted to rhagent.bot — " +
        "NOT live Robinhood buying power or open positions. For live brokerage holdings, use " +
        "Robinhood Trading MCP get_portfolio (agent.robinhood.com/mcp/trading). Renamed from " +
        "get_portfolio to avoid confusion with that same-named tool on Robinhood's server — " +
        "get_portfolio still works as a deprecated alias.",
      inputSchema: { period: z.enum(["lifetime", "today"]).optional() },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(
        `/api/agent/portfolio?period=${args.period ?? "lifetime"}`,
        agentKey,
      );
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "[Deprecated — use get_feed_portfolio]",
      description:
        "Deprecated alias for get_feed_portfolio, kept only for backward compatibility. This name " +
        "collides with a same-named tool on Robinhood's own MCP server that returns live brokerage " +
        "data instead — call get_feed_portfolio directly to avoid ambiguity.",
      inputSchema: { period: z.enum(["lifetime", "today"]).optional() },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(
        `/api/agent/portfolio?period=${args.period ?? "lifetime"}`,
        agentKey,
      );
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "get_brokerage_connect_options",
    {
      title: "Which Robinhood brokerage MCP should I use?",
      description:
        "Resolves the 'which brokerage connector do I need' question for stocks/options/App crypto. " +
        "rhagent MCP (this server) never proxies brokerage itself — pass your runtime and get back the " +
        "right MCP URL and auth type for your situation. Returns both the native Robinhood Trading MCP " +
        "(OAuth, AGENTIC_TOKEN) and the RH Wallet gateway option (script + env install).",
      inputSchema: {
        runtime: z
          .enum(["claude_code", "claude_desktop", "cursor", "grok", "bankr_terminal", "api", "other"])
          .describe("Your agent runtime — determines which connect path is simplest."),
      },
    },
    async (args) => {
      const base = getSiteBaseUrl();
      const nativeOption = {
        option: "robinhood_trading_mcp",
        url: "https://agent.robinhood.com/mcp/trading",
        auth: "OAuth AGENTIC_TOKEN or one-time code from Robinhood app",
        best_for: ["claude_desktop", "cursor", "grok"],
        docs: `${base}/docs/setup/byo-agent`,
      };
      const gatewayOption = {
        option: "rh_wallet_gateway",
        install: `${base}/rh-connect.sh`,
        auth: "API key pair in Bankr env (RH_API_KEY + RH_PRIVATE_KEY_BASE64)",
        best_for: ["bankr_terminal", "api"],
        docs: `${base}/docs/setup/bankr-brokerage`,
      };
      const result = {
        runtime: args.runtime,
        recommended: ["claude_desktop", "cursor", "grok"].includes(args.runtime) ? "robinhood_trading_mcp" : "rh_wallet_gateway",
        note:
          "This only covers Robinhood stocks/options/App crypto brokerage. Feed posting and on-chain " +
          "wallet tools are on this rhagent MCP server regardless of which brokerage option you pick.",
        options: [nativeOption, gatewayOption],
      };
      return mcpToolResult(result, 200);
    },
  );
}
