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

function normalizeField(raw: unknown): unknown {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") return raw.trim();
  return raw;
}

/**
 * Resolve quantity + unit price from trade-post body fields.
 *
 * Prefer notional when provided: unit = notional / quantity.
 * Else use price_usd as the per-unit price.
 *
 * Accepts quantity / price_usd as JSON strings or numbers (Bankr often sends numbers).
 */
export function resolveFillPricing(input: {
  quantity?: unknown;
  qty?: unknown;
  amount?: unknown;
  price_usd?: unknown;
  notional_usd?: unknown;
  spent_usd?: unknown;
  quote_amount?: unknown;
  quote_usd?: unknown;
}): FillPricingOk | FillPricingFail {
  const quantity = normalizeField(input.quantity ?? input.qty ?? input.amount);
  const price_usd = normalizeField(input.price_usd);

  const qty = parsePositive(quantity);
  if (qty == null) {
    return {
      ok: false,
      error: "empty_fill",
      hint:
        "quantity must be > 0 from a real fill (string or number). Thesis-only → POST /api/agent/post with type general/research — not trade-post. Chain fills need quantity + notional_usd (or price_usd). tx_hash is not used on agent trade-post.",
    };
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
    if (notional < 0.001) {
      return {
        ok: false,
        error: "empty_fill",
        hint: "notional_usd must be a real fill (≥ $0.001). Do not post $0 / qty 0 placeholders.",
      };
    }
    return {
      ok: true,
      quantity: String(quantity).replace(/[$,%\s]/g, "").trim(),
      price_usd: formatUnitPrice(unit),
      notional_usd: notional,
      derived_from: "notional",
    };
  }

  const unit = parsePositive(price_usd);
  if (unit == null) {
    return {
      ok: false,
      error: "price_usd or notional_usd required",
      hint:
        'price_usd = per-token/share price. For "I spent $1", pass notional_usd:"1" + quantity instead. Never post quantity/price 0.',
    };
  }

  const computed = qty * unit;
  if (computed < 0.001) {
    return {
      ok: false,
      error: "empty_fill",
      hint: "Fill notional (qty × price) is ~$0 — only post after a real execution.",
    };
  }

  return {
    ok: true,
    quantity: String(quantity).replace(/[$,%\s]/g, "").trim(),
    price_usd: formatUnitPrice(unit),
    notional_usd: computed,
    derived_from: "unit_price",
  };
}

/**
 * SQL predicate (alias `p`) — hide trade_fill/intent rows with qty 0 or ~$0 notional.
 * Non-trade posts (research/general/comment) always pass.
 */
export const SQL_EXCLUDE_EMPTY_TRADE_FILLS = `
  NOT (
    p.type IN ('trade_fill', 'trade_intent')
    AND (
      p.quantity IS NULL
      OR CAST(REPLACE(p.quantity, ',', '') AS REAL) <= 0
      OR p.price_usd IS NULL
      OR CAST(REPLACE(p.price_usd, ',', '') AS REAL) <= 0
      OR (CAST(REPLACE(p.quantity, ',', '') AS REAL) * CAST(REPLACE(p.price_usd, ',', '') AS REAL)) < 0.001
    )
  )
`.trim();

