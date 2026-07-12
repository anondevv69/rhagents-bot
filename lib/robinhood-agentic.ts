/**
 * Validate Robinhood Agentic stock tickers via MCP get_equity_quotes.
 * Requires AGENTIC_CATALOG_TOKEN (Robinhood Agentic bearer) on the server.
 */

const ROBINHOOD_MCP_URL = "https://agent.robinhood.com/mcp/trading";
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;

const okCache = new Map<string, number>();
const noCache = new Map<string, number>();

function walkText(node: unknown): string {
  const chunks: string[] = [];
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string") {
      chunks.push(v);
      return;
    }
    if (typeof v === "object") {
      if (Array.isArray(v)) {
        for (const item of v) walk(item);
        return;
      }
      for (const val of Object.values(v as Record<string, unknown>)) walk(val);
    }
  };
  walk(node);
  return chunks.join("\n");
}

function equityQuoteValid(payload: unknown, symbol: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;
  if (obj.error) return false;
  const result = obj.result;
  if (result && typeof result === "object" && (result as Record<string, unknown>).isError) {
    return false;
  }

  const text = walkText(payload).toUpperCase();
  const sym = symbol.toUpperCase();
  if (!text.includes(sym)) return false;

  const bad = [
    "NOT FOUND",
    "INVALID SYMBOL",
    "UNKNOWN SYMBOL",
    "NO QUOTE",
    "UNRECOGNIZED",
    "COULD NOT FIND",
    "DOES NOT EXIST",
  ];
  if (bad.some((b) => text.includes(b))) return false;

  if (/\$?\d+\.?\d*/.test(text)) return true;
  if (["LAST", "PRICE", "QUOTE", "BID", "ASK", "CLOSE"].some((k) => text.includes(k))) {
    return true;
  }
  return false;
}

/** True if Robinhood MCP confirms a real equity quote for this ticker. */
export async function validateRobinhoodAgenticSymbol(symbol: string): Promise<boolean> {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(sym)) return false;

  const token = process.env.AGENTIC_CATALOG_TOKEN?.trim();
  if (!token) return false;

  const now = Date.now();
  const okAt = okCache.get(sym);
  if (okAt && now - okAt < LOOKUP_TTL_MS) return true;
  const noAt = noCache.get(sym);
  if (noAt && now - noAt < LOOKUP_TTL_MS) return false;

  const payload = {
    jsonrpc: "2.0",
    id: now,
    method: "tools/call",
    params: {
      name: "get_equity_quotes",
      arguments: { symbols: [sym] },
    },
  };

  try {
    const res = await fetch(ROBINHOOD_MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    const valid = res.ok && equityQuoteValid(body, sym);
    if (valid) {
      okCache.set(sym, now);
      noCache.delete(sym);
      return true;
    }
    noCache.set(sym, now);
    return false;
  } catch {
    return false;
  }
}
