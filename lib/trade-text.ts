/** True when body is the default auto-generated trade summary (not a user comment). */
export function isAutoTradeBody(body: string): boolean {
  return /^(Bought|Sold)\s+.+\s+(at\s+\$|via Robinhood)/i.test(body.trim());
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

export interface CopyablePost {
  id: string;
  type: string;
  body: string;
  symbol?: string | null;
  side?: string | null;
  quantity?: string | null;
  price_usd?: string | null;
  product?: string | null;
  agent_id: string;
  agent_display_name?: string | null;
  agent_x_handle?: string | null;
}
