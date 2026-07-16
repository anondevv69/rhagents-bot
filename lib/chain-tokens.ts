/**
 * Robinhood Chain tickers — third product class (not crypto, not agentic).
 *
 * Channel key = ERC-20 symbol (e.g. RHAGENT). Collisions with Robinhood Crypto
 * pairs are rejected or namespaced as SYMBOL.CHAIN.
 */

import { createPublicClient, http, parseAbi, getAddress, isAddress } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { getDb } from "@/lib/db";
import { getSymbolCatalogSync, classifyCryptoSymbol } from "@/lib/symbol-catalog";

export type ChainTokenMeta = {
  symbol: string;
  contract: `0x${string}`;
  name?: string;
};

/** Seed / allowlisted Chain tickers. */
export const CHAIN_SEED_TOKENS: Record<string, ChainTokenMeta> = {
  RHAGENT: {
    symbol: "RHAGENT",
    contract: RHAGENT_TOKEN_CONTRACT as `0x${string}`,
    name: RHAGENT_TOKEN_SYMBOL,
  },
};

const erc20MetaAbi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
]);

let channelCache: { symbols: Set<string>; fetchedAt: number } | null = null;
const CHANNEL_TTL_MS = 30_000;

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

/** Normalize chain ticker input: RHAGENT, $rhagent, or 0x contract. */
export function normalizeChainSymbolInput(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (isAddress(s)) return getAddress(s);
  const upper = s.replace(/^\$/, "").toUpperCase();
  if (upper === "RHAGENT" || upper === "RHAGENT.CHAIN") return "RHAGENT";
  // Chain tickers: up to 12 alnum (ERC-20 symbols), optional .CHAIN suffix
  if (/^[A-Z][A-Z0-9]{0,11}(\.CHAIN)?$/.test(upper)) return upper;
  return null;
}

export function getActiveChainChannelsSync(): Set<string> {
  if (channelCache && Date.now() - channelCache.fetchedAt < CHANNEL_TTL_MS) {
    return channelCache.symbols;
  }
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT DISTINCT symbol FROM posts
    WHERE parent_id IS NULL
      AND product = 'chain'
      AND symbol IS NOT NULL
  `
    )
    .all() as { symbol: string }[];

  const symbols = new Set(Object.keys(CHAIN_SEED_TOKENS));
  for (const row of rows) {
    if (row.symbol) symbols.add(row.symbol.toUpperCase());
  }
  channelCache = { symbols, fetchedAt: Date.now() };
  return symbols;
}

export function isActiveChainChannel(symbol: string): boolean {
  const sym = symbol.trim().toUpperCase();
  return getActiveChainChannelsSync().has(sym);
}

export function invalidateChainChannelCache(): void {
  channelCache = null;
}

export type ChainClassification = {
  product: "chain";
  symbol: string;
  contract?: `0x${string}`;
  source: "seed" | "platform_active" | "onchain_metadata";
};

/** Sync classify: seed + already-open chain channels. No RPC. */
export function classifyChainSymbol(raw: string): ChainClassification | null {
  const input = normalizeChainSymbolInput(raw);
  if (!input) return null;

  if (isAddress(input)) {
    const addr = getAddress(input);
    for (const meta of Object.values(CHAIN_SEED_TOKENS)) {
      if (meta.contract.toLowerCase() === addr.toLowerCase()) {
        return { product: "chain", symbol: meta.symbol, contract: meta.contract, source: "seed" };
      }
    }
    return null; // need async resolve for unknown contracts
  }

  const seed = CHAIN_SEED_TOKENS[input] ?? CHAIN_SEED_TOKENS[input.replace(/\.CHAIN$/, "")];
  if (seed && (input === seed.symbol || input === `${seed.symbol}.CHAIN`)) {
    return { product: "chain", symbol: seed.symbol, contract: seed.contract, source: "seed" };
  }

  if (isActiveChainChannel(input)) {
    return { product: "chain", symbol: input, source: "platform_active" };
  }

  return null;
}

/**
 * Avoid colliding with Robinhood Crypto pairs (PEPE vs PEPE-USD).
 * If the ERC-20 symbol matches a crypto base/pair, namespace as SYMBOL.CHAIN.
 */
export function chainSymbolAvoidingCryptoCollision(erc20Symbol: string): string {
  const sym = erc20Symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  if (!sym) return "TOKEN.CHAIN";
  const crypto = classifyCryptoSymbol(sym, getSymbolCatalogSync());
  if (crypto) return `${sym}.CHAIN`;
  // Also block bare agentic-shaped if it's a known crypto base without -USD in catalog
  if (getSymbolCatalogSync().bases.has(sym)) return `${sym}.CHAIN`;
  return sym;
}

/** Resolve unknown contract → ERC-20 symbol for opening a new chain channel. */
export async function resolveChainTokenFromContract(
  contractRaw: string
): Promise<ChainClassification | { ok: false; error: string }> {
  if (!isAddress(contractRaw)) {
    return { ok: false, error: "Invalid contract address" };
  }
  const contract = getAddress(contractRaw) as `0x${string}`;

  const seeded = classifyChainSymbol(contract);
  if (seeded) return seeded;

  try {
    const client = publicClient();
    const [symbolRaw, nameRaw] = await Promise.all([
      client.readContract({ address: contract, abi: erc20MetaAbi, functionName: "symbol" }),
      client.readContract({ address: contract, abi: erc20MetaAbi, functionName: "name" }).catch(() => ""),
    ]);
    const symbol = chainSymbolAvoidingCryptoCollision(String(symbolRaw ?? ""));
    if (!symbol) {
      return { ok: false, error: "Token has no symbol()" };
    }
    return {
      product: "chain",
      symbol,
      contract,
      source: "onchain_metadata",
      ...(nameRaw ? {} : {}),
    };
  } catch (e) {
    return {
      ok: false,
      error: `Could not read token metadata: ${e instanceof Error ? e.message : "rpc_error"}`,
    };
  }
}

/**
 * Full resolve for posting / API:
 * - known seed / active channel
 * - or 0x contract (RPC metadata)
 * - or new symbol only if already active (opening new by bare symbol requires contract)
 */
export async function resolveChainTicker(raw: string): Promise<
  | ChainClassification
  | { ok: false; error: string; hint?: string }
> {
  const sync = classifyChainSymbol(raw);
  if (sync) return sync;

  const input = normalizeChainSymbolInput(raw);
  if (!input) {
    return {
      ok: false,
      error: "invalid_chain_symbol",
      hint: "Use RHAGENT, an open chain ticker, or a Robinhood Chain ERC-20 contract (0x…)",
    };
  }

  if (isAddress(input)) {
    const resolved = await resolveChainTokenFromContract(input);
    if ("ok" in resolved && resolved.ok === false) return resolved;
    return resolved as ChainClassification;
  }

  // Bare symbol not yet active — tell agent to pass contract to open channel
  return {
    ok: false,
    error: "chain_channel_not_open",
    hint: `Chain channel ${input} is not open yet. POST with product:"chain" and symbol:"0x…contract…" (or RHAGENT) to create it. Docs: /docs#chain`,
  };
}
