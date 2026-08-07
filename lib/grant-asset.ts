/**
 * What a grant gets paid IN.
 *
 * The rule: if a post's thesis is on a specific ticker and that ticker has a
 * tokenized equity on Robinhood Chain, the grant pays in that token — the
 * researcher ends up holding a piece of the thing they called. Everything else
 * pays in $rhagent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The value is decided in $rhagent first, then converted
 *
 * Scoring stays denominated in $rhagent and is untouched by this module: impact
 * → score → $rhagent amount, exactly as before. Only the final settlement asset
 * changes, by converting that amount through USD at live prices.
 *
 * This ordering matters. If the payout were sized directly in shares, the amount
 * of treasury a post consumed would depend on which ticker it happened to be
 * about, and identical work on a $300 stock and a $3 stock would cost the
 * treasury different amounts. Sizing in $rhagent and converting last keeps the
 * grant worth the same regardless of asset, which is what makes the routing a
 * settlement detail rather than a second, hidden scoring rule.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Every fallback is explicit
 *
 * There is no silent degradation. If the ticker is unknown, the pool is thin, a
 * price is unreachable, or the converted amount would round to dust, the result
 * says so in `fallback_reason` and settles in $rhagent. An operator reading a
 * dry-run can always tell why a post paid in what it paid in.
 *
 * A missing price is never treated as zero. A payout computed from a failed
 * price lookup is the kind of bug that pays someone nothing and books it as
 * success, so an unavailable quote falls back rather than proceeding.
 */

import { formatUnits, parseUnits } from "viem";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { fetchTokenPriceUsd } from "@/lib/rhagent-holdings";
import { rwaTokenFor, rwaQuote, rwaPayoutsEnabled, type RwaToken } from "@/lib/rwa-tokens";

export interface GrantAsset {
  kind: "rwa" | "rhagent";
  symbol: string;
  contract: `0x${string}`;
  decimals: number;
  /** Whole token units — shares for an RWA, tokens for $rhagent. */
  amount: number;
  /** Exact on-chain amount. The authority for the transfer; `amount` is display. */
  amount_wei: bigint;
  /** What the payout is worth, when both prices were readable. */
  usd_value: number | null;
  /** The $rhagent-denominated grant this was converted from. Never changes. */
  rhagent_equivalent: number;
  why: string;
  /** Present only when an RWA was possible in principle but not used. */
  fallback_reason?: string;
}

/**
 * Which ticker is this post's thesis about?
 *
 * Options research carries the option in `symbol` and the equity in
 * `underlying_symbol` — an NVDA call thesis should pay in NVDA, since there is
 * no tokenized option to pay in.
 *
 * `product === "chain"` is excluded on purpose. Chain channels are ERC-20
 * symbols, which are self-declared and non-unique: there are 22 tokens on
 * Robinhood Chain calling themselves HOOD. A chain channel named NVDA is a
 * memecoin, not NVIDIA, and must never resolve to the equity token.
 */
export function thesisTicker(post: {
  symbol?: string | null;
  underlying_symbol?: string | null;
  instrument_kind?: string | null;
  product?: string | null;
}): string | null {
  if (post.product === "chain") return null;
  const raw =
    post.instrument_kind === "option" && post.underlying_symbol
      ? post.underlying_symbol
      : (post.symbol ?? null);
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().replace(/^\$/, "").toUpperCase();
  return /^[A-Z][A-Z0-9.\-]{0,11}$/.test(s) ? s : null;
}

function rhagentAsset(
  rhagentAmount: number,
  why: string,
  fallbackReason?: string,
  usdValue: number | null = null,
): GrantAsset {
  return {
    kind: "rhagent",
    symbol: RHAGENT_TOKEN_SYMBOL,
    contract: RHAGENT_TOKEN_CONTRACT as `0x${string}`,
    decimals: 18,
    amount: rhagentAmount,
    amount_wei: parseUnits(String(rhagentAmount), 18),
    usd_value: usdValue,
    rhagent_equivalent: rhagentAmount,
    why,
    ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
  };
}

/**
 * Decide the settlement asset for one grant.
 *
 * Pure resolution — reads prices, touches no database and sends no transaction.
 * Safe to call from a dry run, and called from one before every real payout.
 */
export async function resolveGrantAsset(
  post: {
    symbol?: string | null;
    underlying_symbol?: string | null;
    instrument_kind?: string | null;
    product?: string | null;
  },
  rhagentAmount: number,
): Promise<GrantAsset> {
  const inRhagent = (why: string, reason?: string, usd: number | null = null) =>
    rhagentAsset(rhagentAmount, why, reason, usd);

  if (!(rhagentAmount > 0)) {
    return inRhagent("Nothing to pay.");
  }

  const ticker = thesisTicker(post);
  if (!ticker) {
    return inRhagent(
      post.product === "chain"
        ? `Chain-token research pays in ${RHAGENT_TOKEN_SYMBOL} — chain channel symbols are not equity tickers.`
        : `General research pays in ${RHAGENT_TOKEN_SYMBOL}.`,
    );
  }

  const token: RwaToken | null = rwaTokenFor(ticker);
  if (!token) {
    return inRhagent(
      `No tokenized ${ticker} on Robinhood Chain in the verified registry.`,
      `${ticker}_not_in_registry`,
    );
  }

  if (!rwaPayoutsEnabled()) {
    return inRhagent(
      `Would pay in tokenized ${ticker}, but RWA payouts are switched off.`,
      "rwa_payouts_disabled",
    );
  }

  // Both prices are required: one to value the grant, one to size the shares.
  const [quote, rhagentPrice] = await Promise.all([
    rwaQuote(token),
    fetchTokenPriceUsd(RHAGENT_TOKEN_CONTRACT),
  ]);

  if (!quote.tradeable || quote.price_usd == null) {
    return inRhagent(
      `Tokenized ${ticker} is not payable right now.`,
      quote.reason ?? "rwa_not_tradeable",
    );
  }
  if (rhagentPrice == null || !(rhagentPrice > 0)) {
    return inRhagent(
      `Could not price ${RHAGENT_TOKEN_SYMBOL}, so the conversion to ${ticker} is not trustworthy.`,
      "rhagent_price_unavailable",
    );
  }

  const usdValue = rhagentAmount * rhagentPrice;
  const shares = usdValue / quote.price_usd;

  // Round to the token's own precision, then check the result survived it. A
  // payout that truncates to zero must not be recorded as a successful grant.
  const sharesWei = parseUnits(shares.toFixed(Math.min(token.decimals, 18)), token.decimals);
  if (sharesWei <= BigInt(0)) {
    return inRhagent(
      `Converted ${ticker} amount rounds to zero at ${token.decimals} decimals.`,
      "rwa_amount_below_dust",
      usdValue,
    );
  }

  return {
    kind: "rwa",
    symbol: token.symbol,
    contract: token.contract,
    decimals: token.decimals,
    amount: Number(formatUnits(sharesWei, token.decimals)),
    amount_wei: sharesWei,
    usd_value: usdValue,
    rhagent_equivalent: rhagentAmount,
    why:
      `Thesis was on ${ticker}, which has a tokenized equity on Robinhood Chain, ` +
      `so the grant pays in ${ticker} rather than ${RHAGENT_TOKEN_SYMBOL}.`,
  };
}
