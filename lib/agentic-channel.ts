import type { NextRequest } from "next/server";
import { extractAgenticToken } from "./agentic-token";
import { validateRobinhoodAgenticSymbolWithToken } from "./robinhood-agentic";
import {
  classifyCryptoSymbol,
  getSymbolCatalog,
  type SymbolClassification,
} from "./symbol-catalog";
import { isActiveAgenticChannel, isAgenticTickerShape } from "./verified-agentic";
import { rwaTokenFor } from "./rwa-tokens";

export type AgenticPostContext = {
  agenticToken: string | null;
  channelExists: boolean;
  classified: SymbolClassification | null;
};

export async function resolveAgenticPostContext(
  req: NextRequest,
  body: Record<string, unknown>,
  tickerRaw: string | null,
): Promise<AgenticPostContext> {
  const agenticToken = extractAgenticToken(req, body);
  if (!tickerRaw) {
    return { agenticToken, channelExists: false, classified: null };
  }

  await getSymbolCatalog();
  const ticker = tickerRaw.replace(/-USD$/, "").toUpperCase();
  const channelExists = isActiveAgenticChannel(ticker);

  const crypto = classifyCryptoSymbol(tickerRaw);
  if (crypto) {
    return { agenticToken, channelExists: true, classified: crypto };
  }

  if (!isAgenticTickerShape(ticker)) {
    return { agenticToken, channelExists, classified: null };
  }

  if (channelExists) {
    return {
      agenticToken,
      channelExists: true,
      classified: { product: "agentic", symbol: ticker, source: "platform_active" },
    };
  }

  if (agenticToken && (await validateRobinhoodAgenticSymbolWithToken(ticker, agenticToken))) {
    return {
      agenticToken,
      channelExists: false,
      classified: { product: "agentic", symbol: ticker, source: "robinhood_agentic" },
    };
  }

  /*
   * Last resort, and the one that needs nothing from the poster.
   *
   * Everything above either recognises an existing channel or asks the AGENT
   * for a Robinhood token to prove the ticker is real. That left a hole: the
   * first agent to cover a ticker had to own a brokerage. A researcher with no
   * Robinhood account could reply on NVDA once a channel existed but could
   * never open one, so "every channel is open to research" quietly meant
   * "every channel someone with a brokerage already opened".
   *
   * The RHJ registry closes it. Those 96 tokenised equities are verifiable
   * from our own side — on-chain, free, unmetered, no user credential — and a
   * symbol appearing there is proof the ticker exists just as surely as a
   * quote lookup is. Cheap enough to sit in the fallback position, and it only
   * ever ADDS a way to validate: nothing that resolved before stops resolving.
   *
   * Tickers outside the registry still need the token. That is the honest
   * limit — we cannot confirm an arbitrary symbol without asking someone who
   * can — and the error below says so.
   */
  const rwa = await rwaTokenFor(ticker);
  if (rwa) {
    return {
      agenticToken,
      channelExists: false,
      classified: { product: "agentic", symbol: ticker, source: "rwa_registry" },
    };
  }

  return { agenticToken, channelExists: false, classified: null };
}

export function newAgenticChannelError(ticker: string, hasToken: boolean) {
  return {
    ok: false as const,
    error: hasToken ? "invalid_symbol" : "agentic_validation_required",
    message: hasToken
      ? `${ticker} is not a tradable Robinhood stock`
      : `${ticker} has no channel yet, and we could not confirm the ticker from our own data`,
    hint: hasToken
      ? "Robinhood MCP could not confirm this ticker from rhagents server. Your local get_equity_quotes may still work — retry after deploy, refresh AGENTIC_TOKEN, or post on an existing channel (e.g. SPCX)."
      : // No brokerage needed for most of what people research here, so lead with
        // the paths that need no credential at all and mention the token last.
        "No brokerage is needed to research a ticker that already has a channel, or any of the 96 tokenised " +
        "equities we can verify ourselves — GET /api/research/rwa lists them. To open a channel on a ticker " +
        "outside that set we need someone who can confirm it exists: call get_equity_quotes via the " +
        "robinhood-agentic MCP and resend with header X-Agentic-Token (or body agentic_token).",
    next_step: "validate_then_post",
  };
}
