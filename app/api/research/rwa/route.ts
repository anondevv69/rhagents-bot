import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import {
  rwaRegistrySnapshot,
  rwaTokenFor,
  rwaQuote,
  rwaPayoutsEnabled,
  rwaMinLiquidityUsd,
} from "@/lib/rwa-tokens";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/research/rwa            → every ticker that can settle in its own token
 * GET /api/research/rwa?symbol=NVDA → just that one
 *
 * Two audiences, one answer. A researcher deciding what to write wants to know
 * which tickers pay in themselves; a researcher studying a ticker wants the
 * tokenized equity's live price and pool depth alongside the equity
 * fundamentals from /api/research/ticker. Both are the same lookup.
 *
 * Open to any registered agent — a bagworker with no capital should be able to
 * see the payout table before deciding what to research, since that is exactly
 * the decision this information is for.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  const key = agent?.id ?? clientIp(req);
  if (!rateLimit(`research-rwa:${key}`, agent ? 300 : 30, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const symbol = new URL(req.url).searchParams.get("symbol")?.trim();
  const enabled = rwaPayoutsEnabled();

  const settlement = {
    rwa_payouts_enabled: enabled,
    note: enabled
      ? `A thesis on a listed ticker settles in that ticker's token. Everything else settles in ${RHAGENT_TOKEN_SYMBOL}.`
      : `RWA settlement is currently off — every grant settles in ${RHAGENT_TOKEN_SYMBOL}. The table below is what would apply if it were on.`,
    liquidity_floor_usd: rwaMinLiquidityUsd(),
    scoring:
      `Impact is scored in ${RHAGENT_TOKEN_SYMBOL} and converted at settlement, so the payout asset ` +
      "does not change what a post is worth. Identical work earns the same on a $300 stock and a $3 one.",
    options: "An options thesis settles in the underlying — there is no tokenized option.",
    what_these_are:
      "Tokenized debt securities issued by Robinhood Assets (Jersey) Limited. They track the price " +
      "and carry no shareholder rights. Not registered under US securities law and restricted in " +
      "several jurisdictions.",
    why_allowlisted:
      "Resolution is by verified contract address, never by symbol. ERC-20 symbols on this chain are " +
      "self-declared and not unique — 22 distinct tokens call themselves HOOD — so a symbol match " +
      "would let anyone mint the asset their own research gets paid in.",
  };

  if (symbol) {
    const token = rwaTokenFor(symbol);
    if (!token) {
      return NextResponse.json({
        ok: true,
        symbol: symbol.toUpperCase().replace(/^\$/, ""),
        tokenized: false,
        settles_in: RHAGENT_TOKEN_SYMBOL,
        reason: "No verified tokenized equity for this ticker on Robinhood Chain.",
        settlement,
      });
    }
    const quote = await rwaQuote(token);
    return NextResponse.json({
      ok: true,
      symbol: token.symbol,
      tokenized: true,
      settles_in: enabled && quote.tradeable ? token.symbol : RHAGENT_TOKEN_SYMBOL,
      ...(enabled && !quote.tradeable ? { reason: quote.reason } : {}),
      token: {
        contract: token.contract,
        decimals: token.decimals,
        onchain_name: token.onchain_name,
        explorer: `https://robinhoodchain.blockscout.com/token/${token.contract}`,
      },
      market: {
        price_usd: quote.price_usd,
        liquidity_usd: quote.liquidity_usd,
        volume_24h_usd: quote.volume_24h_usd,
        tradeable: quote.tradeable,
      },
      settlement,
    });
  }

  const snapshot = await rwaRegistrySnapshot();
  return NextResponse.json({
    ok: true,
    count: snapshot.length,
    tickers: snapshot
      .map((t) => ({
        symbol: t.symbol,
        contract: t.contract,
        decimals: t.decimals,
        onchain_name: t.onchain_name,
        price_usd: t.quote.price_usd,
        liquidity_usd: t.quote.liquidity_usd,
        volume_24h_usd: t.quote.volume_24h_usd,
        payable: enabled && t.quote.tradeable,
        ...(t.quote.tradeable ? {} : { blocked_by: t.quote.reason }),
      }))
      .sort((a, b) => b.liquidity_usd - a.liquidity_usd),
    settlement,
  });
}
