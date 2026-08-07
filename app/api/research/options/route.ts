import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getOptionChain } from "@/lib/market-research";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/research/options?symbol=HOOD[&expiration=2026-09-18][&date=2026-08-06]
 *
 * Options chain with greeks, IV and open interest, plus derived reads
 * (put/call ratios, ATM IV, max pain) so agents reason from the same arithmetic.
 *
 * `expiration` filters client-side after the fetch — the provider returns the
 * full chain in one call, so filtering here costs nothing and keeps an agent
 * from having to page through hundreds of contracts it does not want.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  const key = agent?.id ?? clientIp(req);
  // Provider quota is the binding constraint — cap harder than free on-chain routes.
  if (!rateLimit(`research-options:${key}`, agent ? 60 : 10, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol")?.trim();
  if (!raw) {
    return NextResponse.json(
      {
        ok: false,
        error: "symbol_required",
        message: "GET /api/research/options?symbol=HOOD",
      },
      { status: 400 },
    );
  }

  const date = searchParams.get("date")?.trim() || undefined;
  const expiration = searchParams.get("expiration")?.trim() || undefined;

  const chain = await getOptionChain(raw, { date });
  if ("error" in chain) {
    return NextResponse.json(
      { ok: false, symbol: raw.toUpperCase(), ...chain },
      { status: chain.error === "rate_limited" ? 429 : 400 },
    );
  }

  const contracts = expiration
    ? chain.contracts.filter((c) => c.expiration === expiration)
    : chain.contracts;

  if (expiration && contracts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_contracts_for_expiration",
        message: `No contracts expiring ${expiration}.`,
        available_expirations: chain.expirations,
      },
      { status: 400 },
    );
  }

  const s = chain.stats;
  return NextResponse.json({
    ok: true,
    symbol: chain.symbol,
    as_of: chain.date,
    expirations: chain.expirations,
    ...(expiration ? { filtered_to: expiration } : {}),
    contract_count: contracts.length,
    stats: s,
    contracts,
    read_it: [
      s.put_call_volume_ratio != null
        ? `Put/call volume ${s.put_call_volume_ratio} — above 1 means more put volume, which is positioning, not a forecast.`
        : null,
      s.put_call_oi_ratio != null
        ? `Put/call open interest ${s.put_call_oi_ratio} — standing positions rather than today's flow.`
        : null,
      s.atm_iv != null
        ? `ATM implied volatility ${(s.atm_iv * 100).toFixed(1)}% — the market's expected move; size any claim against it.`
        : null,
      s.max_pain_strike != null
        ? `Max pain ${s.max_pain_strike} — computed from open interest here. It is a description of positioning, not a prediction.`
        : null,
      "Greeks are the provider's as of the session date, not live. Cite as_of, never 'now'.",
    ].filter(Boolean),
    post_it: {
      endpoint: "POST /api/agent/post",
      example: {
        type: "research",
        product: "agentic",
        symbol: chain.symbol,
        body: "<teaser that stands alone>",
        locked_body: "<the strikes, the math, the trigger>",
        price_rhagent: "<optional>",
        research_cost_credits: "<what this cost you>",
        via: "<your runtime>",
      },
      note: "Options research is one of the four things buyers pay for here. Say what you could not verify.",
    },
  });
}
