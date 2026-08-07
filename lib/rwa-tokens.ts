/**
 * Tokenized equities on Robinhood Chain — canonical registry + quotes.
 *
 * Resolution is by **contract address from Robinhood's official asset API**,
 * never by searching ERC-20 symbols on-chain. Symbols on a permissionless chain
 * are self-declared and non-unique (22 distinct tokens call themselves HOOD).
 *
 * Source of truth: GET https://api.robinhood.com/rhj/assets
 * Docs: https://docs.robinhood.com/chain/stock-token-apis/
 *       https://docs.robinhood.com/chain/contracts
 *
 * Prices: RHJ /prices (official bid/ask) + Dexscreener liquidity for payout depth.
 */

import { robinhoodChain } from "@/lib/onchain-config";

const RHJ_ASSETS_URL = "https://api.robinhood.com/rhj/assets";
const RHJ_PRICES_URL = "https://api.robinhood.com/rhj/prices";
const RH_CHAIN_ID = robinhoodChain.id;

/** Issuer marker in tokenName from RHJ — auditable on-chain too. */
const ISSUER_MARKER = "• Robinhood Token";

export interface RwaToken {
  symbol: string;
  contract: `0x${string}`;
  decimals: number;
  onchain_name: string;
  verified: boolean;
  source: "rhj" | "operator" | "seed";
  status?: string;
  asset_id?: string;
  logo_url?: string;
  current_multiplier?: string;
}

export interface RwaQuote {
  symbol: string;
  contract: `0x${string}`;
  price_usd: number | null;
  liquidity_usd: number;
  volume_24h_usd: number;
  tradeable: boolean;
  price_source?: "rhj" | "dexscreener";
  reason?: string;
}

interface RhjAsset {
  id: string;
  tokenSymbol: string;
  tokenName: string;
  deployments: { contractAddress: string; chainId: number }[];
  currentMultiplier?: string;
  status?: string;
  logoUrl?: string;
  tokenDecimals?: number;
}

interface RhjPriceQuote {
  tokenSymbol: string;
  bid: string;
  ask: string;
  isTradingHalt?: boolean;
  dailyTradingVolume?: string;
}

/** Minimal seed if RHJ API is unreachable — not the primary registry. */
export const RWA_SEED_TOKENS: Record<string, RwaToken> = {
  NVDA: {
    symbol: "NVDA",
    contract: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    decimals: 18,
    onchain_name: "NVIDIA • Robinhood Token",
    verified: true,
    source: "seed",
  },
};

let registryCache: { at: number; map: Record<string, RwaToken> } | null = null;
let pricesCache: { at: number; map: Record<string, RhjPriceQuote> } | null = null;

const REGISTRY_TTL_MS = 5 * 60_000;
const PRICES_TTL_MS = 60_000;
const quoteCache = new Map<string, { q: RwaQuote; at: number }>();
const QUOTE_TTL_MS = 60_000;

export function rwaPayoutsEnabled(): boolean {
  return process.env.RHAGENT_RWA_PAYOUTS_ENABLED === "true";
}

export function rwaMinLiquidityUsd(): number {
  const n = parseFloat(process.env.RHAGENT_RWA_MIN_LIQUIDITY_USD ?? "50000");
  return Number.isFinite(n) && n >= 0 ? n : 50_000;
}

function operatorTokens(): Record<string, RwaToken> {
  const raw = (process.env.RHAGENT_RWA_TOKENS || "").trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!Array.isArray(parsed)) return {};

  const out: Record<string, RwaToken> = {};
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const symbol = typeof o.symbol === "string" ? o.symbol.trim().toUpperCase() : "";
    const contract = typeof o.contract === "string" ? o.contract.trim() : "";
    if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) continue;
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) continue;
    const decimals = typeof o.decimals === "number" && o.decimals >= 0 && o.decimals <= 36 ? o.decimals : 18;
    out[symbol] = {
      symbol,
      contract: contract as `0x${string}`,
      decimals,
      onchain_name: typeof o.name === "string" ? o.name : "(operator-supplied)",
      verified: true,
      source: "operator",
    };
  }
  return out;
}

function rhjAssetToToken(a: RhjAsset): RwaToken | null {
  const dep = a.deployments.find((d) => d.chainId === RH_CHAIN_ID);
  if (!dep?.contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(dep.contractAddress)) return null;
  const symbol = a.tokenSymbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) return null;
  return {
    symbol,
    contract: dep.contractAddress as `0x${string}`,
    decimals: typeof a.tokenDecimals === "number" ? a.tokenDecimals : 18,
    onchain_name: a.tokenName,
    verified: a.tokenName.includes(ISSUER_MARKER),
    source: "rhj",
    status: a.status,
    asset_id: a.id,
    logo_url: a.logoUrl,
    current_multiplier: a.currentMultiplier,
  };
}

async function fetchRhjAssets(): Promise<Record<string, RwaToken>> {
  if (registryCache && Date.now() - registryCache.at < REGISTRY_TTL_MS) {
    return registryCache.map;
  }

  const map: Record<string, RwaToken> = {};
  try {
    const res = await fetch(RHJ_ASSETS_URL, { signal: AbortSignal.timeout(12_000) });
    if (res.ok) {
      const body = (await res.json()) as { assets?: RhjAsset[] };
      for (const a of body.assets ?? []) {
        if (a.status && a.status !== "ASSET_STATUS_ACTIVE") continue;
        const t = rhjAssetToToken(a);
        if (t) map[t.symbol] = t;
      }
    }
  } catch {
    /* fall through to seed */
  }

  if (Object.keys(map).length === 0) {
    Object.assign(map, RWA_SEED_TOKENS);
  }

  registryCache = { at: Date.now(), map };
  return map;
}

async function fetchRhjPrices(): Promise<Record<string, RhjPriceQuote>> {
  if (pricesCache && Date.now() - pricesCache.at < PRICES_TTL_MS) {
    return pricesCache.map;
  }

  const map: Record<string, RhjPriceQuote> = {};
  try {
    const res = await fetch(RHJ_PRICES_URL, { signal: AbortSignal.timeout(12_000) });
    if (res.ok) {
      const body = (await res.json()) as { quotes?: RhjPriceQuote[] };
      for (const q of body.quotes ?? []) {
        const sym = q.tokenSymbol?.trim().toUpperCase();
        if (sym) map[sym] = q;
      }
    }
  } catch {
    /* empty map — callers fall back to dex */
  }

  pricesCache = { at: Date.now(), map };
  return map;
}

function rhjMidPrice(q: RhjPriceQuote | undefined): number | null {
  if (!q || q.isTradingHalt) return null;
  const bid = parseFloat(q.bid);
  const ask = parseFloat(q.ask);
  if (!(bid > 0) || !(ask > 0)) return null;
  return (bid + ask) / 2;
}

/** Full registry: Robinhood RHJ assets on chain 4663, then operator overrides. */
export async function getRwaRegistry(): Promise<Record<string, RwaToken>> {
  const rhj = await fetchRhjAssets();
  return { ...rhj, ...operatorTokens() };
}

/** @deprecated sync stub — use getRwaRegistry() or rwaTokenFor(). */
export function rwaRegistry(): Record<string, RwaToken> {
  return registryCache?.map ?? { ...RWA_SEED_TOKENS, ...operatorTokens() };
}

export async function rwaTokenFor(symbolRaw: string | null | undefined): Promise<RwaToken | null> {
  if (!symbolRaw || typeof symbolRaw !== "string") return null;
  const symbol = symbolRaw.trim().replace(/^\$/, "").toUpperCase();
  if (!symbol) return null;
  const reg = await getRwaRegistry();
  return reg[symbol] ?? null;
}

export function looksIssuerMinted(onchainName: string | null | undefined): boolean {
  return typeof onchainName === "string" && onchainName.includes(ISSUER_MARKER);
}

async function dexLiquidity(contract: string): Promise<{ liquidity: number; volume: number; price: number | null }> {
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/robinhood/${contract.toLowerCase()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { liquidity: 0, volume: 0, price: null };
    const pairs = (await res.json()) as {
      priceUsd?: string;
      liquidity?: { usd?: number };
      volume?: { h24?: number };
    }[];
    if (!Array.isArray(pairs) || !pairs.length) return { liquidity: 0, volume: 0, price: null };
    const liquidity = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    const volume = pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    const deepest = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));
    const px = parseFloat(deepest.priceUsd ?? "");
    const price = Number.isFinite(px) && px > 0 ? px : null;
    return { liquidity, volume, price };
  } catch {
    return { liquidity: 0, volume: 0, price: null };
  }
}

/**
 * Quote a known contract. Price from RHJ (official); liquidity from Dexscreener.
 * Payout path needs liquidity — listing can skip dex with includeLiquidity=false.
 */
export async function rwaQuote(
  token: RwaToken,
  opts: { includeLiquidity?: boolean } = {},
): Promise<RwaQuote> {
  const includeLiquidity = opts.includeLiquidity !== false;
  const key = token.contract.toLowerCase();
  const cacheKey = `${key}:${includeLiquidity ? "full" : "price"}`;
  const hit = quoteCache.get(cacheKey);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.q;

  const prices = await fetchRhjPrices();
  const rhjPx = rhjMidPrice(prices[token.symbol]);

  let liquidity = 0;
  let volume = 0;
  let dexPrice: number | null = null;
  if (includeLiquidity) {
    const dex = await dexLiquidity(key);
    liquidity = dex.liquidity;
    volume = dex.volume;
    dexPrice = dex.price;
  }

  const price = rhjPx ?? dexPrice;
  const price_source = rhjPx != null ? "rhj" : dexPrice != null ? "dexscreener" : undefined;
  const floor = rwaMinLiquidityUsd();

  let q: RwaQuote;
  if (price == null) {
    q = {
      symbol: token.symbol,
      contract: token.contract,
      price_usd: null,
      liquidity_usd: liquidity,
      volume_24h_usd: volume,
      tradeable: false,
      reason: "price_unavailable",
    };
  } else if (includeLiquidity && liquidity < floor) {
    q = {
      symbol: token.symbol,
      contract: token.contract,
      price_usd: price,
      liquidity_usd: liquidity,
      volume_24h_usd: volume,
      tradeable: false,
      price_source,
      reason: `liquidity $${Math.round(liquidity).toLocaleString()} below floor $${floor.toLocaleString()}`,
    };
  } else {
    q = {
      symbol: token.symbol,
      contract: token.contract,
      price_usd: price,
      liquidity_usd: liquidity,
      volume_24h_usd: volume,
      tradeable: true,
      price_source,
    };
  }

  quoteCache.set(cacheKey, { q, at: Date.now() });
  return q;
}

/** Registry + RHJ prices; dex liquidity only when requested (slow for 96 tokens). */
export async function rwaRegistrySnapshot(opts: { withLiquidity?: boolean } = {}): Promise<
  (RwaToken & { quote: RwaQuote })[]
> {
  const withLiquidity = opts.withLiquidity === true;
  const [tokens, prices] = await Promise.all([getRwaRegistry(), fetchRhjPrices()]);

  const entries = Object.values(tokens).map((t) => {
    const mid = rhjMidPrice(prices[t.symbol]);
    if (!withLiquidity) {
      const quote: RwaQuote = {
        symbol: t.symbol,
        contract: t.contract,
        price_usd: mid,
        liquidity_usd: 0,
        volume_24h_usd: parseFloat(prices[t.symbol]?.dailyTradingVolume ?? "0") || 0,
        tradeable: mid != null,
        price_source: mid != null ? "rhj" : undefined,
        ...(mid == null ? { reason: "price_unavailable" } : {}),
      };
      return { ...t, quote };
    }
    return null;
  });

  if (!withLiquidity) {
    return entries.filter(Boolean) as (RwaToken & { quote: RwaQuote })[];
  }

  // Full liquidity pass — batched to avoid hammering Dexscreener
  const list = Object.values(tokens);
  const out: (RwaToken & { quote: RwaQuote })[] = [];
  const batch = 8;
  for (let i = 0; i < list.length; i += batch) {
    const chunk = list.slice(i, i + batch);
    const quoted = await Promise.all(chunk.map((t) => rwaQuote(t, { includeLiquidity: true })));
    for (let j = 0; j < chunk.length; j++) {
      out.push({ ...chunk[j], quote: quoted[j] });
    }
  }
  return out;
}

export function rhjRegistryMeta() {
  return {
    assets_url: RHJ_ASSETS_URL,
    prices_url: RHJ_PRICES_URL,
    chain_id: RH_CHAIN_ID,
    docs: [
      "https://docs.robinhood.com/chain/contracts",
      "https://docs.robinhood.com/chain/oracles-and-price-feeds",
      "https://docs.robinhood.com/chain/stock-token-apis",
    ],
  };
}
