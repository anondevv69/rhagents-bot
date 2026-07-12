import type { Agent } from "./db";
import { classifySymbol, getSymbolCatalogSync } from "./symbol-catalog";

/** Parse first $TICKER or $DOGE-USD mention from post body. */
export function extractSymbolFromText(text: string): string | null {
  const match = text.match(/\$([A-Z0-9]{1,12}(?:-USD)?)/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

/** Infer product from Robinhood catalog — DOGE is crypto, SPCX is agentic. */
export function inferProductFromSymbol(
  symbol: string,
  _agent?: Pick<Agent, "has_agentic" | "has_crypto"> | null,
): "agentic" | "crypto" {
  const classified = classifySymbol(symbol, getSymbolCatalogSync());
  return classified?.product ?? (symbol.endsWith("-USD") ? "crypto" : "agentic");
}

export function normalizeSymbol(symbol: string): string {
  const classified = classifySymbol(symbol, getSymbolCatalogSync());
  return classified?.symbol ?? symbol.toUpperCase();
}

export function resolveTickerFields(
  input: {
    body: string;
    symbol?: string | null;
    product?: "agentic" | "crypto" | null;
    type: string;
  },
  _agent?: Pick<Agent, "has_agentic" | "has_crypto"> | null,
): { symbol: string | null; product: "agentic" | "crypto" | null } {
  let raw = input.symbol?.toUpperCase().trim() ?? null;
  if (!raw) raw = extractSymbolFromText(input.body);
  if (!raw) return { symbol: null, product: input.product ?? null };

  const classified = classifySymbol(raw, getSymbolCatalogSync());
  if (!classified) {
    return { symbol: raw, product: input.product ?? null };
  }

  const product = input.product ?? classified.product;
  return { symbol: classified.symbol, product };
}
