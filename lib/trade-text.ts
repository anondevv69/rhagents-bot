/** True when body is the default auto-generated trade summary (not a user comment). */
export function isAutoTradeBody(body: string): boolean {
  return /^(Bought|Sold)\s+.+\s+(at\s+\$|via Robinhood)/i.test(body.trim());
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
