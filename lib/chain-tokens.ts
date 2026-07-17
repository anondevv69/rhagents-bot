/**
 * Robinhood Chain tickers — third product class (not crypto, not agentic).
 *
 * Channel key = ERC-20 symbol (e.g. RHAGENT). Collisions with Robinhood Crypto
 * pairs are rejected or namespaced as SYMBOL.CHAIN.
 */

import { createPublicClient, http, parseAbi, getAddress, isAddress } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";
import { getDb } from "@/lib/db";
import { getSymbolCatalogSync, classifyCryptoSymbol } from "@/lib/symbol-catalog";
import { assertRobinhoodChainCryptoToken } from "@/lib/robinhood-chain-crypto";

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
    /** Human-facing token name (distinct from ticker $RHAGENT). */
    name: "rhagent",
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
  const fromPosts = db
    .prepare(
      `
    SELECT DISTINCT symbol FROM posts
    WHERE parent_id IS NULL
      AND product = 'chain'
      AND symbol IS NOT NULL
  `
    )
    .all() as { symbol: string }[];

  // Channels opened via MetaMask "Create channel" land in chain_tickers before the first post.
  const fromMeta = db
    .prepare(`SELECT DISTINCT symbol FROM chain_tickers WHERE symbol IS NOT NULL`)
    .all() as { symbol: string }[];

  const symbols = new Set(Object.keys(CHAIN_SEED_TOKENS));
  for (const row of fromPosts) {
    if (row.symbol) symbols.add(row.symbol.toUpperCase());
  }
  for (const row of fromMeta) {
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

/** Persist / refresh Chain ticker identity when a room is opened or a fill posts. */
export function upsertChainTickerMeta(meta: {
  symbol: string;
  contract: string;
  name?: string | null;
}): void {
  if (!isAddress(meta.contract)) return;
  const symbol = meta.symbol.trim().toUpperCase();
  if (!symbol) return;
  const contract = getAddress(meta.contract);
  const name = meta.name?.trim() || null;
  const db = getDb();
  db.prepare(
    `
    INSERT INTO chain_tickers (symbol, contract, name, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(symbol) DO UPDATE SET
      contract = excluded.contract,
      name = COALESCE(excluded.name, chain_tickers.name),
      updated_at = datetime('now')
  `
  ).run(symbol, contract, name);
}

/** Resolve display meta for a Chain ticker page (seed → DB). */
export function getChainTickerMeta(symbolRaw: string): ChainTokenMeta | null {
  const input = normalizeChainSymbolInput(symbolRaw);
  if (!input || isAddress(input)) return null;
  const sym = input.replace(/\.CHAIN$/, "");
  const seed = CHAIN_SEED_TOKENS[sym] ?? CHAIN_SEED_TOKENS[input];
  if (seed) return seed;

  const row = getDb()
    .prepare(`SELECT symbol, contract, name FROM chain_tickers WHERE symbol = ? OR symbol = ?`)
    .get(input, sym) as { symbol: string; contract: string; name: string | null } | undefined;
  if (!row || !isAddress(row.contract)) return null;
  return {
    symbol: row.symbol,
    contract: getAddress(row.contract) as `0x${string}`,
    name: row.name ?? undefined,
  };
}

/** Empty stats shell so seed / known Chain rooms render before the first post. */
export function emptyChainSymbolStats(symbol: string): {
  symbol: string;
  product: "chain";
  trade_count: number;
  buy_count: number;
  sell_count: number;
  agent_count: number;
  normie_count: number;
  thesis_count: number;
  volume_usd: number;
  last_trade_at: string | null;
} {
  return {
    symbol: symbol.toUpperCase(),
    product: "chain",
    trade_count: 0,
    buy_count: 0,
    sell_count: 0,
    agent_count: 0,
    normie_count: 0,
    thesis_count: 0,
    volume_usd: 0,
    last_trade_at: null,
  };
}

export type ChainClassification = {
  product: "chain";
  symbol: string;
  contract?: `0x${string}`;
  name?: string;
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
        return {
          product: "chain",
          symbol: meta.symbol,
          contract: meta.contract,
          name: meta.name,
          source: "seed",
        };
      }
    }
    return null; // need async resolve for unknown contracts
  }

  const seed = CHAIN_SEED_TOKENS[input] ?? CHAIN_SEED_TOKENS[input.replace(/\.CHAIN$/, "")];
  if (seed && (input === seed.symbol || input === `${seed.symbol}.CHAIN`)) {
    return {
      product: "chain",
      symbol: seed.symbol,
      contract: seed.contract,
      name: seed.name,
      source: "seed",
    };
  }

  if (isActiveChainChannel(input)) {
    const stored = getChainTickerMeta(input);
    return {
      product: "chain",
      symbol: input,
      contract: stored?.contract,
      name: stored?.name,
      source: "platform_active",
    };
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
): Promise<ChainClassification | { ok: false; error: string; hint?: string }> {
  if (!isAddress(contractRaw)) {
    return { ok: false, error: "Invalid contract address" };
  }
  const contract = getAddress(contractRaw) as `0x${string}`;

  const seeded = classifyChainSymbol(contract);
  if (seeded) return seeded;

  const gate = await assertRobinhoodChainCryptoToken(contract);
  if (!gate.ok) {
    return { ok: false, error: gate.error, hint: gate.hint };
  }

  try {
    const client = publicClient();
    const [symbolRaw, nameRaw] = await Promise.all([
      client.readContract({ address: contract, abi: erc20MetaAbi, functionName: "symbol" }),
      client.readContract({ address: contract, abi: erc20MetaAbi, functionName: "name" }).catch(() => null),
    ]);
    const fromMeta = chainSymbolAvoidingCryptoCollision(String(symbolRaw ?? ""));
    const symbol =
      fromMeta ||
      (gate.symbol_hint
        ? chainSymbolAvoidingCryptoCollision(gate.symbol_hint)
        : "TOKEN.CHAIN");
    if (!symbol) {
      return { ok: false, error: "Token has no symbol()" };
    }
    const name = nameRaw != null ? String(nameRaw).trim().slice(0, 64) || undefined : undefined;
    return {
      product: "chain",
      symbol,
      contract,
      name,
      source: "onchain_metadata",
    };
  } catch (e) {
    return {
      ok: false,
      error: `Could not read token metadata: ${e instanceof Error ? e.message : "rpc_error"}`,
      hint: "Contract must be a Robinhood Chain crypto token with a readable symbol().",
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
    if ("ok" in resolved && resolved.ok === false) {
      return { ok: false, error: resolved.error, hint: resolved.hint };
    }
    return resolved as ChainClassification;
  }

  // Reject App Crypto pairs attempted as Chain
  const asAppCrypto = classifyCryptoSymbol(input, getSymbolCatalogSync());
  if (asAppCrypto) {
    return {
      ok: false,
      error: "app_crypto_not_chain",
      hint: `${asAppCrypto.symbol} is Robinhood App Crypto — use product:"crypto", not Chain.`,
    };
  }

  // Bare symbol not yet active — tell agent to pass contract to open channel
  return {
    ok: false,
    error: "chain_channel_not_open",
    hint: `Chain channel ${input} is not open yet. Pass a Robinhood Chain crypto contract (0x…) listed on DexScreener/hood.markets, or RHAGENT. Docs: /docs#chain`,
  };
}
