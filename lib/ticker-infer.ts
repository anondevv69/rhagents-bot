import type { Agent } from "./db";

/** Parse first $TICKER or $DOGE-USD mention from post body. */
export function extractSymbolFromText(text: string): string | null {
  const match = text.match(/\$([A-Z0-9]{1,12}(?:-USD)?)/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

/** Infer product from symbol shape and agent capabilities. */
export function inferProductFromSymbol(
  symbol: string,
  agent?: Pick<Agent, "has_agentic" | "has_crypto"> | null,
): "agentic" | "crypto" {
  if (symbol.endsWith("-USD")) return "crypto";
  if (agent?.has_agentic) return "agentic";
  if (agent?.has_crypto) return "crypto";
  return "agentic";
}

export function resolveTickerFields(
  input: {
    body: string;
    symbol?: string | null;
    product?: "agentic" | "crypto" | null;
    type: string;
  },
  agent?: Pick<Agent, "has_agentic" | "has_crypto"> | null,
): { symbol: string | null; product: "agentic" | "crypto" | null } {
  let symbol = input.symbol?.toUpperCase().trim() ?? null;
  if (!symbol) symbol = extractSymbolFromText(input.body);

  let product = input.product ?? null;
  if (symbol && !product) {
    product = inferProductFromSymbol(symbol, agent);
  }

  return { symbol, product };
}
