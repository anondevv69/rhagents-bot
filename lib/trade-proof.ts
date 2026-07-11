/**
 * Trade-proof verification — zero custody.
 * Agent buys a small amount via their own Robinhood wallet (rh-wallet, Bankr, etc.).
 * They submit fill proof — we never receive RH keys or tokens.
 */

export const VERIFICATION_TRADES = {
  crypto: {
    product: "crypto" as const,
    symbol: "DOGE-USD",
    side: "buy" as const,
    min_usd: 0.10,
    instruction: "Buy ~$0.10 of DOGE-USD on Robinhood Crypto (via rh-wallet or your agent runtime)",
  },
  agentic: {
    product: "agentic" as const,
    symbol: "SPCX",
    side: "buy" as const,
    min_usd: 0.10,
    instruction: "Buy ~$0.10 of SPCX on Robinhood Agentic (via rh-wallet or your agent runtime)",
  },
};

export type VerificationProduct = keyof typeof VERIFICATION_TRADES;

export function getVerificationChallenge(product: VerificationProduct) {
  return VERIFICATION_TRADES[product];
}

/** Validate submitted fill matches verification challenge */
export function validateTradeProof(
  challenge: { symbol: string; side: string; min_usd: number; product: string },
  proof: { symbol: string; side: string; quantity: string; price_usd: string }
): { ok: true; notional_usd: number } | { ok: false; error: string } {
  const sym = proof.symbol.toUpperCase().replace(/^\$/, "");
  const expected = challenge.symbol.toUpperCase();

  if (sym !== expected && sym !== expected.replace("-USD", "")) {
    return { ok: false, error: `Symbol must be ${expected}, got ${sym}` };
  }

  if (proof.side.toLowerCase() !== challenge.side) {
    return { ok: false, error: `Side must be ${challenge.side}` };
  }

  const qty = parseFloat(proof.quantity);
  const price = parseFloat(String(proof.price_usd).replace(/[$,]/g, ""));
  if (Number.isNaN(qty) || Number.isNaN(price) || qty <= 0 || price <= 0) {
    return { ok: false, error: "Invalid quantity or price_usd" };
  }

  const notional = qty * price;
  const min = challenge.min_usd * 0.85; // 15% tolerance for fees/slippage
  const max = challenge.min_usd * 3; // allow small overfill (e.g. 1 share min)

  if (notional < min) {
    return {
      ok: false,
      error: `Trade notional $${notional.toFixed(2)} is below required ~$${challenge.min_usd.toFixed(2)}`,
    };
  }
  if (notional > max && challenge.min_usd <= 0.15) {
    return {
      ok: false,
      error: `Trade notional $${notional.toFixed(2)} seems too large for verification (expected ~$${challenge.min_usd})`,
    };
  }

  return { ok: true, notional_usd: notional };
}
