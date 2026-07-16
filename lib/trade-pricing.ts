/**
 * Fill pricing for trade-post.
 *
 * Stored `price_usd` is always the **per-unit** execution price (share / token).
 * UI + PnL compute notional as quantity × price_usd.
 *
 * Agents often know "I spent $1" better than unit price on memecoins — pass
 * `notional_usd` / `spent_usd` / `quote_amount` + `quantity` and we derive unit price.
 */

export type FillPricingOk = {
  ok: true;
  /** Per-unit USD price stored on the post */
  price_usd: string;
  quantity: string;
  notional_usd: number;
  derived_from: "unit_price" | "notional";
};

export type FillPricingFail = {
  ok: false;
  error: string;
  hint?: string;
};

function parsePositive(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[$,%\s]/g, "").trim();
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Enough decimals for cheap memecoins without scientific notation in SQLite TEXT. */
export function formatUnitPrice(unit: number): string {
  if (!Number.isFinite(unit) || unit <= 0) return "0";
  if (unit >= 1) return unit.toFixed(6).replace(/\.?0+$/, "");
  // up to ~12 significant decimals for sub-cent tokens
  const s = unit.toFixed(12).replace(/\.?0+$/, "");
  return s || unit.toPrecision(8);
}

/**
 * Resolve quantity + unit price from trade-post body fields.
 *
 * Prefer notional when provided: unit = notional / quantity.
 * Else use price_usd as the per-unit price.
 */
export function resolveFillPricing(input: {
  quantity?: unknown;
  price_usd?: unknown;
  notional_usd?: unknown;
  spent_usd?: unknown;
  quote_amount?: unknown;
  quote_usd?: unknown;
}): FillPricingOk | FillPricingFail {
  const qty = parsePositive(input.quantity);
  if (qty == null) {
    return { ok: false, error: "quantity is required (tokens or shares filled)" };
  }

  const notional =
    parsePositive(input.notional_usd) ??
    parsePositive(input.spent_usd) ??
    parsePositive(input.quote_amount) ??
    parsePositive(input.quote_usd);

  if (notional != null) {
    const unit = notional / qty;
    if (!Number.isFinite(unit) || unit <= 0) {
      return { ok: false, error: "Could not derive unit price from notional / quantity" };
    }
    return {
      ok: true,
      quantity: String(input.quantity).replace(/[$,%\s]/g, "").trim(),
      price_usd: formatUnitPrice(unit),
      notional_usd: notional,
      derived_from: "notional",
    };
  }

  const unit = parsePositive(input.price_usd);
  if (unit == null) {
    return {
      ok: false,
      error: "price_usd or notional_usd required",
      hint:
        'price_usd = per-token/share price. For "I spent $1", pass notional_usd:"1" + quantity instead.',
    };
  }

  return {
    ok: true,
    quantity: String(input.quantity).replace(/[$,%\s]/g, "").trim(),
    price_usd: formatUnitPrice(unit),
    notional_usd: qty * unit,
    derived_from: "unit_price",
  };
}
