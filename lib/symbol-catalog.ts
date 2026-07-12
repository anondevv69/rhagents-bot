/**
 * Robinhood symbol catalog — crypto pairs from gateway API, agentic = equities not in crypto.
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";
const TTL_MS = 60 * 60 * 1000;

const STATIC_CRYPTO_PAIRS = [
  "BTC-USD", "ETH-USD", "DOGE-USD", "SHIB-USD", "PEPE-USD", "SOL-USD", "ADA-USD",
  "XRP-USD", "AVAX-USD", "LINK-USD", "LTC-USD", "BCH-USD", "ETC-USD", "XLM-USD",
  "XTZ-USD", "UNI-USD", "AAVE-USD", "COMP-USD", "MATIC-USD", "DOT-USD", "NEAR-USD",
  "APT-USD", "ARB-USD", "OP-USD", "BONK-USD", "WIF-USD", "FLOKI-USD",
];

type CatalogCache = {
  pairs: Set<string>;
  bases: Set<string>;
  source: string;
  fetchedAt: number;
};

let cache: CatalogCache | null = null;
let inflight: Promise<CatalogCache> | null = null;

function basesFromPairs(pairs: string[]): Set<string> {
  const bases = new Set<string>();
  for (const pair of pairs) {
    const upper = pair.toUpperCase();
    if (upper.endsWith("-USD")) bases.add(upper.slice(0, -4));
    else bases.add(upper);
  }
  return bases;
}

function buildCache(pairs: string[], source: string): CatalogCache {
  const normalized = pairs.map((p) => p.toUpperCase());
  return {
    pairs: new Set(normalized),
    bases: basesFromPairs(normalized),
    source,
    fetchedAt: Date.now(),
  };
}

export async function refreshSymbolCatalog(): Promise<CatalogCache> {
  try {
    const res = await fetch(`${GW}/v1/catalog/symbols`, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        crypto?: { pairs?: string[] };
        source?: string;
      };
      const pairs = data.crypto?.pairs?.filter(Boolean) ?? [];
      if (pairs.length > 0) {
        cache = buildCache(pairs, data.source ?? "robinhood");
        return cache;
      }
    }
  } catch {
    /* fall through to static */
  }

  cache = buildCache(STATIC_CRYPTO_PAIRS, "static");
  return cache;
}

export async function getSymbolCatalog(): Promise<CatalogCache> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = refreshSymbolCatalog().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Sync read — static catalog until async refresh runs. */
export function getSymbolCatalogSync(): CatalogCache {
  if (cache) return cache;
  cache = buildCache(STATIC_CRYPTO_PAIRS, "static");
  return cache;
}

export type SymbolClassification = {
  product: "agentic" | "crypto";
  symbol: string;
};

/** Map user/agent symbol to canonical form + Robinhood product lane. */
export function classifySymbol(raw: string, cat = getSymbolCatalogSync()): SymbolClassification | null {
  const input = raw.trim().toUpperCase();
  if (!input) return null;

  if (input.endsWith("-USD")) {
    return { product: "crypto", symbol: input };
  }

  if (cat.bases.has(input) || cat.pairs.has(`${input}-USD`)) {
    return { product: "crypto", symbol: `${input}-USD` };
  }

  if (/^[A-Z]{1,5}$/.test(input)) {
    return { product: "agentic", symbol: input };
  }

  return null;
}
