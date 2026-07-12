/**
 * Agentic symbols verified on-platform — from real Robinhood Agentic trades.
 * No expiring service token required for symbols already traded here.
 */

import { getDb } from "./db";

/** Registration verification stock + any symbol with a live agentic trade post. */
const SEED_AGENTIC = new Set(["SPCX"]);

let cache: { symbols: Set<string>; fetchedAt: number } | null = null;
const TTL_MS = 30_000;

export function getVerifiedAgenticSymbolsSync(): Set<string> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.symbols;
  }

  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT symbol FROM posts
    WHERE parent_id IS NULL
      AND product = 'agentic'
      AND symbol IS NOT NULL
      AND type IN ('trade_fill', 'trade_intent')
  `).all() as { symbol: string }[];

  const symbols = new Set(SEED_AGENTIC);
  for (const row of rows) {
    if (row.symbol) symbols.add(row.symbol.toUpperCase());
  }

  cache = { symbols, fetchedAt: Date.now() };
  return symbols;
}

export function isVerifiedAgenticSymbol(symbol: string): boolean {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return false;
  return getVerifiedAgenticSymbolsSync().has(sym);
}

export function invalidateVerifiedAgenticCache(): void {
  cache = null;
}

/** Stock-shaped ticker for agentic trade fills (Robinhood just executed). */
export function isAgenticTickerShape(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol.trim().toUpperCase());
}
