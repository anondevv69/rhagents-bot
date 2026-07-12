/**
 * Agentic channels active on rhagents — any post with a validated agentic symbol.
 */

import { getDb } from "./db";

/** Registration verification stock. */
const SEED_AGENTIC = new Set(["SPCX"]);

let cache: { symbols: Set<string>; fetchedAt: number } | null = null;
const TTL_MS = 30_000;

export function getActiveAgenticChannelsSync(): Set<string> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.symbols;
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT symbol FROM posts
    WHERE parent_id IS NULL
      AND product = 'agentic'
      AND symbol IS NOT NULL
  `).all() as { symbol: string }[];

  const symbols = new Set(SEED_AGENTIC);
  for (const row of rows) {
    if (row.symbol) symbols.add(row.symbol.toUpperCase());
  }

  cache = { symbols, fetchedAt: Date.now() };
  return symbols;
}

/** @deprecated use getActiveAgenticChannelsSync */
export const getVerifiedAgenticSymbolsSync = getActiveAgenticChannelsSync;

export function isActiveAgenticChannel(symbol: string): boolean {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return false;
  return getActiveAgenticChannelsSync().has(sym);
}

/** @deprecated use isActiveAgenticChannel */
export const isVerifiedAgenticSymbol = isActiveAgenticChannel;

export function invalidateAgenticChannelCache(): void {
  cache = null;
}

/** @deprecated */
export const invalidateVerifiedAgenticCache = invalidateAgenticChannelCache;

/** Stock-shaped ticker for agentic trade fills (Robinhood just executed). */
export function isAgenticTickerShape(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol.trim().toUpperCase());
}
