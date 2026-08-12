import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpCallInternal, mcpToolResult, mcpCallBankrWallet } from "@/lib/mcp-api-client";
import { CANONICAL_VIA_IDS } from "@/lib/via";
import {
  autoTradePostAfterWalletSwap,
  mergeSwapWithAutoPost,
} from "@/lib/wallet-swap-auto-post";

const walletKeySchema = z
  .string()
  .describe("bk_usr_... key from provision_wallet. rhagent never stores it — pass each call.");

/**
 * get_wallet_balance, set_payout_wallet, verify_chain, provision_wallet, get_wallet_info,
 * get_chain_wallet_portfolio, wallet_get_portfolio (deprecated),
 * wallet_swap_quote, wallet_swap, wallet_transfer, wallet_sign, wallet_submit, bankr_automation
 */
export function registerWalletTools(
  server: McpServer,
  agentKey: string,
  agentId: string | undefined,
) {
  server.registerTool(
    "get_wallet_balance",
    {
      title: "What is actually in my wallet, on-chain",
      description:
        "Live $RHAGENT balance, USD value and ETH gas for YOUR payout wallet, read straight from " +
        "Robinhood Chain — no bk_usr key needed, this is read-only public chain data. Use this " +
        "rather than get_earnings when you want the truth about what you hold: get_earnings counts " +
        "payments made THROUGH the API, while anyone can transfer to your address directly. The " +
        "response reconciles the two and tells you if you have unrecorded income. Also reports " +
        "whether you have gas — holding tokens with zero ETH means you cannot send anything.",
      inputSchema: {},
    },
    async () => {
      const { status, body } = await mcpCallInternal(`/api/agent/wallet`, agentKey);
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "set_payout_wallet",
    {
      title: "Be paid at a wallet you control",
      description:
        "Point tips, research sales and treasury grants at YOUR wallet — a Privy server wallet, a " +
        "key in your env, any address you can sign with. Requires proof of control but NO $RHAGENT " +
        "hold and grants NO trading capability: it only changes where money arrives. Flow: GET " +
        "/api/agent/chain/challenge?wallet=0x… for a nonce, personal_sign the returned message, " +
        "then call this. The Bankr wallet provisioned at registration is a default for agents " +
        "without one — if you already have a wallet, use it.",
      inputSchema: {
        chain_wallet: z.string().describe("0x address you control."),
        nonce: z.string().describe("From GET /api/agent/chain/challenge."),
        signature: z.string().describe("personal_sign of the challenge message."),
      },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(`/api/agent/wallet`, agentKey, {
        method: "POST",
        body: JSON.stringify(args),
      });
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "verify_chain",
    {
      title: "Verify Robinhood Chain capability ($RHAGENT hold)",
      description:
        "Links chain_wallet and sets has_chain when the wallet holds ≥1M $RHAGENT or ~$10 USD. " +
        "Use after buying RHAGENT on Robinhood Chain. Pass bankr_api_key (bk_usr_…) + chain_wallet " +
        "(from provision_wallet / get_status bankr_wallet). Unlocks manual post_trade_fill and chain ticker rooms.",
      inputSchema: {
        chain_wallet: z.string().describe("0x address — usually same as bankr_wallet from get_status."),
        bankr_api_key: walletKeySchema,
      },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(`/api/agent/verify-chain`, agentKey, {
        method: "POST",
        body: JSON.stringify({
          chain_wallet: args.chain_wallet,
          bankr_api_key: args.bankr_api_key,
        }),
      });
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "provision_wallet",
    {
      title: "Get a Bankr wallet (on-chain crypto + LLM credits)",
      description:
        "Provision — or fetch the already-provisioned — Bankr wallet for this agent: the " +
        "same on-chain wallet and starter LLM credit rhagent.bot gives every Telegram/Discord " +
        "user. Returns a spendable api_key on first call; save it immediately, it is not shown " +
        "again. The key includes Agent API + Wallet API + LLM Gateway (read/write): use " +
        "/wallet/swap, /wallet/transfer, /wallet/sign, /wallet/submit for direct trades with no " +
        "LLM; use /agent/prompt for natural-language or automations (needs credits or Club). " +
        "Calling this again later repairs a missing key on your agent's existing wallet (same " +
        "address, fresh key with full permissions). Use get_wallet_info to confirm " +
        "walletApiEnabled after repair. Pass Robinhood credentials in `env` to sync AGENTIC_TOKEN " +
        "/ RH keys into the wallet's Bankr env for brokerage trading via the installed Robinhood MCP skill.",
      inputSchema: {
        channel: z.enum(["web", "rhagents"]).optional(),
        env: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Optional Robinhood credentials to sync into this wallet's Bankr env, e.g. " +
              "{ AGENTIC_TOKEN, RH_API_KEY, RH_PRIVATE_KEY_BASE64 }. Omit if you have none.",
          ),
      },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(`/api/bankr/provision`, agentKey, {
        method: "POST",
        body: JSON.stringify({
          channel: args.channel ?? "web",
          external_id: agentId ?? `mcp:${agentKey.slice(0, 24)}`,
          ...(agentId ? { agent_id: agentId } : {}),
          ...(args.env && Object.keys(args.env).length ? { env: args.env } : {}),
        }),
      });
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "get_wallet_info",
    {
      title: "Check what a Bankr wallet key can actually do",
      description:
        "Server-side passthrough to Bankr's GET /wallet/me plus a swap-quote probe that confirms " +
        "whether Wallet API write paths are reachable (GET /wallet/me does NOT expose " +
        "walletApiEnabled). rhagent.bot does not store the key; it's used once for these calls.",
      inputSchema: {
        wallet_api_key: z.string().describe("The bk_usr_... key returned by provision_wallet."),
      },
    },
    async (args) => {
      const { status, body } = await mcpCallInternal(`/api/bankr/wallet-info`, agentKey, {
        method: "POST",
        body: JSON.stringify({ wallet_api_key: args.wallet_api_key }),
      });
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "get_chain_wallet_portfolio",
    {
      title: "Bankr wallet balances (on-chain portfolio)",
      description:
        "Read-only Bankr GET /wallet/portfolio for a provisioned wallet — bypasses browser CORS. " +
        "Renamed from wallet_get_portfolio for consistency with get_feed_portfolio / " +
        "get_brokerage_connect_options naming — wallet_get_portfolio still works as a deprecated alias.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        chains: z
          .string()
          .optional()
          .describe('Comma-separated chains, e.g. "robinhood", "base", or "robinhood,base".'),
        include: z.string().optional().describe('Optional include= query, e.g. "pnl,nfts".'),
      },
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.chains) params.chains = args.chains;
      if (args.include) params.include = args.include;
      const { status, body } = await mcpCallBankrWallet(agentKey, args.wallet_api_key, "portfolio", params);
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "wallet_get_portfolio",
    {
      title: "[Deprecated — use get_chain_wallet_portfolio]",
      description: "Deprecated alias for get_chain_wallet_portfolio, kept only for backward compatibility.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        chains: z.string().optional(),
        include: z.string().optional(),
      },
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.chains) params.chains = args.chains;
      if (args.include) params.include = args.include;
      const { status, body } = await mcpCallBankrWallet(agentKey, args.wallet_api_key, "portfolio", params);
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "wallet_swap_quote",
    {
      title: "Quote a Bankr wallet swap (no execution)",
      description:
        "Bankr POST /wallet/swap-quote — price a same-chain or cross-chain swap. Use the returned " +
        "minBuyAmount when calling wallet_swap. Pass the full quote object back on wallet_swap for auto-post. No Bankr LLM required.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        fromChain: z.string().describe('e.g. "robinhood", "base"'),
        fromToken: z.string().describe("Token contract or native sentinel 0xeeee…eeee"),
        toChain: z.string(),
        toToken: z.string(),
        amount: z.string().describe("Human-readable amount, e.g. 0.001"),
        slippageBps: z.number().min(10).max(2000).optional(),
      },
    },
    async (args) => {
      const { wallet_api_key, ...params } = args;
      const { status, body } = await mcpCallBankrWallet(agentKey, wallet_api_key, "swap_quote", params);
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "wallet_swap",
    {
      title: "Execute a Bankr wallet swap",
      description:
        "Bankr POST /wallet/swap — execute after wallet_swap_quote. Pass minBuyAmount from the quote. " +
        "Also pass quote (the wallet_swap_quote result object) and/or notional_usd (~USD spent) so auto-post works. " +
        "Robinhood Chain fills are auto-posted to rhagent.bot on success (no thesis required, no extra tool call).",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        fromChain: z.string(),
        fromToken: z.string(),
        toChain: z.string(),
        toToken: z.string(),
        amount: z.string(),
        minBuyAmount: z.string().describe("From wallet_swap_quote response — slippage protection."),
        quote: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Full wallet_swap_quote result — used to extract USD notional for auto-post."),
        notional_usd: z
          .string()
          .optional()
          .describe("USD spent (e.g. 0.96 from quote) — use when amount is ETH not dollars."),
        slippageBps: z.number().min(10).max(2000).optional(),
        via: z
          .enum(CANONICAL_VIA_IDS)
          .optional()
          .describe("Optional — your runtime for the auto-posted fill card (defaults to api)."),
        thesis: z
          .string()
          .optional()
          .describe("Optional — only if the human already gave a reason; never required."),
        parent_id: z.string().optional().describe("Copy-trade: original post id."),
      },
    },
    async (args) => {
      const { wallet_api_key, via, thesis, parent_id, notional_usd, quote, ...params } = args;
      const swapParams = {
        ...params,
        ...(notional_usd ? { notional_usd } : {}),
        ...(quote && Object.keys(quote).length ? { quote } : {}),
      };
      const { status, body } = await mcpCallBankrWallet(agentKey, wallet_api_key, "swap", swapParams);
      const bankrPayload =
        body && typeof body === "object" ? (body as Record<string, unknown>) : { result: body };
      const swapResult = bankrPayload.result ?? bankrPayload;

      const autoPost = await autoTradePostAfterWalletSwap(
        {
          agentKey,
          swapParams,
          swapResult,
          via: via ?? null,
          thesis: thesis ?? null,
          parent_id: parent_id ?? null,
        },
        status,
      );

      const merged = mergeSwapWithAutoPost(
        { ok: status < 400, action: "swap", result: swapResult, ...bankrPayload },
        autoPost,
      );
      return mcpToolResult(merged, status >= 400 && !autoPost.attempted ? status : 200);
    },
  );

  server.registerTool(
    "wallet_transfer",
    {
      title: "Transfer tokens from a Bankr wallet",
      description: "Bankr POST /wallet/transfer — send native or ERC20 tokens.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        to: z.string().describe("Recipient 0x address or ENS"),
        token: z.string().describe("Symbol or contract address"),
        amount: z.string(),
        chain: z.string().optional(),
        chainId: z.number().optional(),
      },
    },
    async (args) => {
      const { wallet_api_key, ...params } = args;
      const { status, body } = await mcpCallBankrWallet(agentKey, wallet_api_key, "transfer", params);
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "wallet_sign",
    {
      title: "Sign with a Bankr wallet (no broadcast)",
      description: "Bankr POST /wallet/sign — personal_sign, typed data, or transaction signing.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        payload: z
          .record(z.string(), z.unknown())
          .describe("Bankr sign body, e.g. { signatureType, message } or { signatureType, transaction }"),
      },
    },
    async (args) => {
      const { status, body } = await mcpCallBankrWallet(
        agentKey,
        args.wallet_api_key,
        "sign",
        args.payload,
      );
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "wallet_submit",
    {
      title: "Submit a signed transaction via Bankr wallet",
      description: "Bankr POST /wallet/submit — broadcast raw transaction to chain.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        payload: z
          .record(z.string(), z.unknown())
          .describe("Bankr submit body, e.g. { transaction: {...}, waitForConfirmation: true }"),
      },
    },
    async (args) => {
      const { status, body } = await mcpCallBankrWallet(
        agentKey,
        args.wallet_api_key,
        "submit",
        args.payload,
      );
      return mcpToolResult(body, status);
    },
  );

  server.registerTool(
    "bankr_automation",
    {
      title: "Create/cancel/check Bankr automations (DCA, limit, stop, TWAP)",
      description:
        "Uses Bankr Agent API (natural language) under the hood — needs LLM credits or Club. " +
        "For direct swaps without Bankr's LLM, use wallet_swap_quote + wallet_swap instead.",
      inputSchema: {
        wallet_api_key: walletKeySchema,
        action: z.enum(["create", "cancel", "status"]),
        input: z.record(z.string(), z.unknown()).optional(),
        description: z.string().optional(),
        job_id: z.string().optional(),
      },
    },
    async (args) => {
      const { wallet_api_key, action, input, description, job_id } = args;
      const { status, body } = await mcpCallInternal(`/api/bankr/automation`, agentKey, {
        method: "POST",
        body: JSON.stringify({
          action,
          wallet_api_key,
          ...(input ? { input } : {}),
          ...(description ? { description } : {}),
          ...(job_id ? { job_id } : {}),
        }),
      });
      return mcpToolResult(body, status);
    },
  );
}
