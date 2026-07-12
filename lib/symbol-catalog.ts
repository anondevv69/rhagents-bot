/**
 * Robinhood symbol validation — crypto from RH API; agentic from platform trade proof.
 */

const GW = process.env.RH_WALLET_GATEWAY ?? "https://rhwallet-rhagent-production.up.railway.app";
const CATALOG_TTL_MS = 60 * 60 * 1000;
const RESOLVE_TTL_MS = 24 * 60 * 60 * 1000;

const STATIC_CRYPTO_PAIRS = [
  "BTC-USD", "ETH-USD", "DOGE-USD", "SHIB-USD", "PEPE-USD", "SOL-USD", "ADA-USD",
  "XRP-USD", "AVAX-USD", "LINK-USD", "LTC-USD", "BCH-USD", "ETC-USD", "XLM-USD",
  "XTZ-USD", "UNI-USD", "AAVE-USD", "COMP-USD", "MATIC-USD", "DOT-USD", "NEAR-USD",
  "APT-USD", "ARB-USD", "OP-USD", "BONK-USD", "WIF-USD", "FLOKI-USD",
];

export type SymbolClassification = {
  product: "agentic" | "crypto";
  symbol: string;
  source?: "robinhood_crypto" | "platform_verified" | "gateway_mcp";
};

type CatalogCache = {
  pairs: Set<string>;
  bases: Set<string>;
  source: string;
  fetchedAt: number;
};

type ResolveCacheEntry = {
  result: SymbolClassification | null;
  fetchedAt: number;
};

let catalog: CatalogCache | null = null;
let catalogInflight: Promise<CatalogCache> | null = null;
const resolveCache = new Map<string, ResolveCacheEntry>();

function basesFromPairs(pairs: string[]): Set<string> {
  const bases = new Set<string>();
  for (const pair of pairs) {
    const upper = pair.toUpperCase();
    if (upper.endsWith("-USD")) bases.add(upper.slice(0, -4));
    else bases.add(upper);
  }
  return bases;
}

function buildCatalog(pairs: string[], source: string): CatalogCache {
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
      const data = (await res.json()) as { crypto?: { pairs?: string[] }; source?: string };
      const pairs = data.crypto?.pairs?.filter(Boolean) ?? [];
      if (pairs.length > 0) {
        catalog = buildCatalog(pairs, data.source ?? "robinhood");
        return catalog;
      }
    }
  } catch {
    /* static fallback */
  }

  catalog = buildCatalog(STATIC_CRYPTO_PAIRS, "static");
  return catalog;
}

export async function getSymbolCatalog(): Promise<CatalogCache> {
  if (catalog && Date.now() - catalog.fetchedAt < CATALOG_TTL_MS) return catalog;
  if (catalogInflight) return catalogInflight;
  catalogInflight = refreshSymbolCatalog().finally(() => {
    catalogInflight = null;
  });
  return catalogInflight;
}

export function getSymbolCatalogSync(): CatalogCache {
  if (catalog) return catalog;
  catalog = buildCatalog(STATIC_CRYPTO_PAIRS, "static");
  return catalog;
}

/** Strict crypto-only check against cached Robinhood pairs. */
export function classifyCryptoSymbol(raw: string, cat = getSymbolCatalogSync()): SymbolClassification | null {
  const input = raw.trim().toUpperCase();
  if (!input) return null;

  if (input.endsWith("-USD")) {
    return cat.pairs.has(input) ? { product: "crypto", symbol: input, source: "robinhood_crypto" } : null;
  }

  const pair = `${input}-USD`;
  if (cat.pairs.has(pair)) {
    return { product: "crypto", symbol: pair, source: "robinhood_crypto" };
  }
  return null;
}

async function resolveViaGatewayMcp(input: string): Promise<SymbolClassification | null> {
  try {
    const res = await fetch(`${GW}/v1/catalog/resolve?symbol=${encodeURIComponent(input)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: "agentic" | "crypto"; symbol?: string };
    if (data.product === "agentic" && data.symbol) {
      return { product: "agentic", symbol: data.symbol.toUpperCase(), source: "gateway_mcp" };
    }
  } catch {
    /* optional fallback */
  }
  return null;
}

export type ResolveOptions = {
  /** Commentary/research — must be platform-verified or gateway MCP. */
  allowGatewayMcp?: boolean;
  /** Check rhagents DB for prior agentic trade posts (instant, no token). */
  checkPlatformVerified?: () => boolean;
};

/**
 * Resolve tradable symbol:
 * 1. Crypto → Robinhood trading_pairs catalog
 * 2. Agentic → already traded on rhagents (instant)
 * 3. Agentic → optional gateway MCP if AGENTIC_CATALOG_TOKEN set
 */
export async function resolveTradableSymbol(
  raw: string,
  options: ResolveOptions = {},
): Promise<SymbolClassification | null> {
  const { allowGatewayMcp = true, checkPlatformVerified } = options;
  const input = raw.trim().toUpperCase();
  if (!input) return null;

  await getSymbolCatalog();
  const crypto = classifyCryptoSymbol(input);
  if (crypto) return crypto;

  if (!/^[A-Z]{1,5}$/.test(input.replace(/-USD$/, ""))) {
    return null;
  }
  const ticker = input.replace(/-USD$/, "");

  const cached = resolveCache.get(ticker);
  if (cached && Date.now() - cached.fetchedAt < RESOLVE_TTL_MS) {
    return cached.result;
  }

  if (checkPlatformVerified?.()) {
    const result: SymbolClassification = {
      product: "agentic",
      symbol: ticker,
      source: "platform_verified",
    };
    resolveCache.set(ticker, { result, fetchedAt: Date.now() });
    return result;
  }

  let result: SymbolClassification | null = null;
  if (allowGatewayMcp) {
    result = await resolveViaGatewayMcp(ticker);
  }

  resolveCache.set(ticker, { result, fetchedAt: Date.now() });
  return result;
}

/** @deprecated use resolveTradableSymbol */
export function classifySymbol(raw: string): SymbolClassification | null {
  return classifyCryptoSymbol(raw);
}
