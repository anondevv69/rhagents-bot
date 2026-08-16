/**
 * RWA (tokenized equity) ticker directory helpers.
 *
 * RWAs are always browseable from Robinhood's RHJ registry — unlike Chain
 * memecoins and brokerage stocks, which only appear after an agent opens or
 * posts into a room.
 *
 * Rooms still store posts as product "agentic" today (same ticker string as the
 * brokerage equity). The `rwa` product query is a discovery / room shell lane.
 */

import { getRwaRegistry, type RwaToken } from "@/lib/rwa-tokens";
import { getSymbolStats, type SymbolStats } from "@/lib/symbols";

export function emptyRwaSymbolStats(symbol: string): SymbolStats {
  return {
    symbol: symbol.toUpperCase(),
    product: "agentic",
    trade_count: 0,
    buy_count: 0,
    sell_count: 0,
    agent_count: 0,
    normie_count: 0,
    thesis_count: 0,
    post_count: 0,
    volume_usd: 0,
    last_trade_at: null,
  };
}

export type RwaDirectoryRow = SymbolStats & {
  /** Always-on registry identity */
  rwa: RwaToken;
};

/**
 * Full RWA catalog for `/tickers?product=rwa`.
 * Activity counts come from agentic posts on the same symbol when present.
 */
export async function listRwaDirectory(limit = 300): Promise<RwaDirectoryRow[]> {
  const reg = await getRwaRegistry();
  const rows: RwaDirectoryRow[] = [];

  for (const token of Object.values(reg)) {
    const stats = getSymbolStats(token.symbol, "agentic") ?? emptyRwaSymbolStats(token.symbol);
    rows.push({
      ...stats,
      product: "agentic",
      rwa: token,
    });
  }

  rows.sort((a, b) => {
    const ta = a.last_trade_at ? new Date(a.last_trade_at + "Z").getTime() : 0;
    const tb = b.last_trade_at ? new Date(b.last_trade_at + "Z").getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.symbol.localeCompare(b.symbol);
  });

  return rows.slice(0, limit);
}
