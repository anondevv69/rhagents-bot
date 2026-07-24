/** True when body is the default auto-generated trade summary (not a user comment). */
export function isAutoTradeBody(body: string): boolean {
  return /^(Bought|Sold)\s+.+\s+(at\s+\$|via Robinhood)/i.test(body.trim());
}

/** Long market-scan style posts — collapse in feed. */
export function isDenseScanBody(body: string | null | undefined): boolean {
  const t = (body ?? "").trim();
  if (!t) return false;
  return t.length > 320 || t.split("\n").length > 6;
}

export function scanBodySummary(body: string): string {
  const line = body.trim().split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

/** User thesis on a trade post, or null if body is only the auto fill summary. */
export function getTradeThesis(body: string | null | undefined): string | null {
  if (!body || isAutoTradeBody(body)) return null;
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Format a price that may be very small (e.g. PEPE $0.0000028) with enough decimals. */
export function formatSmartPrice(price: number): string {
  if (price === 0) return "$0.00";
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  // For sub-cent prices, show enough significant digits (at least 4 sig figs)
  const log = Math.floor(Math.log10(price));
  const decimals = Math.abs(log) + 3;
  return `$${price.toFixed(Math.min(decimals, 10))}`;
}

export function tradeNotionalUsd(post: {
  quantity?: string | null;
  price_usd?: string | null;
}): number | null {
  if (!post.quantity || !post.price_usd) return null;
  const q = parseFloat(post.quantity);
  const p = parseFloat(post.price_usd);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  return q * p;
}

/** Total USD value of a fill — matches profile trades table "Amount". */
export function formatTradeNotional(post: {
  quantity?: string | null;
  price_usd?: string | null;
}): string {
  const n = tradeNotionalUsd(post);
  return n != null ? `$${n.toFixed(2)}` : "—";
}

/** Optional fill breakdown: "245,018 @ $0.00000281" */
export function formatTradeFillDetail(post: {
  quantity?: string | null;
  price_usd?: string | null;
}): string | null {
  if (!post.quantity || !post.price_usd) return null;
  const q = parseFloat(post.quantity);
  const p = parseFloat(post.price_usd);
  if (!Number.isFinite(q) || !Number.isFinite(p)) return null;
  const qtyStr = Number.isInteger(q) ? q.toLocaleString() : post.quantity;
  return `${qtyStr} @ ${formatSmartPrice(p)}`;
}

export interface CopyablePost {
  id: string;
  type: string;
  body: string;
  symbol?: string | null;
  side?: string | null;
  quantity?: string | null;
  price_usd?: string | null;
  product?: string | null;
  /** Robinhood Chain ERC-20 — required for unambiguous swaps (AUTIST etc. collide by name). */
  contract?: string | null;
  agent_id: string;
  agent_display_name?: string | null;
  agent_x_handle?: string | null;
  created_at?: string | null;
}
