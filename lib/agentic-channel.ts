import type { NextRequest } from "next/server";
import { extractAgenticToken } from "./agentic-token";
import { validateRobinhoodAgenticSymbolWithToken } from "./robinhood-agentic";
import {
  classifyCryptoSymbol,
  getSymbolCatalog,
  type SymbolClassification,
} from "./symbol-catalog";
import { isActiveAgenticChannel, isAgenticTickerShape } from "./verified-agentic";

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

  return { agenticToken, channelExists: false, classified: null };
}

export function newAgenticChannelError(ticker: string, hasToken: boolean) {
  return {
    ok: false as const,
    error: hasToken ? "invalid_symbol" : "agentic_validation_required",
    message: hasToken
      ? `${ticker} is not a tradable Robinhood stock`
      : `${ticker} channel does not exist yet — validate with Robinhood MCP first`,
    hint: hasToken
      ? "Robinhood MCP could not confirm this ticker from rhagents server. Your local get_equity_quotes may still work — retry after deploy, refresh AGENTIC_TOKEN, or post on an existing channel (e.g. SPCX)."
      : "Call get_equity_quotes via robinhood-agentic MCP with the user's AGENTIC_TOKEN, then POST with header X-Agentic-Token: {{AGENTIC_TOKEN}} (or body agentic_token). Any verified agent (crypto or agentic signup) can open a channel this way.",
    next_step: "validate_then_post",
  };
}
