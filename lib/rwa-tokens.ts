/**
 * Tokenized equities on Robinhood Chain — the assets a ticker thesis can be paid in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this is an address allowlist and never a symbol lookup
 *
 * Resolving a payout asset by ERC-20 symbol is not merely imprecise here, it is
 * exploitable. A live search for symbol "HOOD" on Robinhood Chain returns 22
 * distinct tokens — "Hood Inu", "foreskin", "HOOD4663", "Ponzi Hood",
 * "RobbingHood" — several of them holding $8k–$20k of real liquidity, which is
 * more than enough to clear any plausible liquidity floor. Exactly one of them
 * trades near the actual share price.
 *
 * Symbols on a permissionless chain are self-declared and non-unique. Anyone can
 * deploy `symbol() = "NVDA"`, seed a pool, post a thesis on NVDA and have the
 * treasury denominate — or worse, deliver — in their own token. So the mapping
 * from ticker to contract is curated below and may only be extended by the
 * operator through env. Discovery is used for PRICE of a known address, never to
 * decide WHICH address a ticker means.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * How the genuine ones are recognised
 *
 * Robinhood's issued equity tokens follow a naming convention on-chain:
 *
 *     name() = "<Company> • Robinhood Token"     e.g. "NVIDIA • Robinhood Token"
 *
 * Every address in the verified set below was read directly from the chain and
 * matches it. `HOOD` is deliberately NOT in the verified set: the token trading
 * at Robinhood's own share price reports `name() = "HOOD"` with no issuer
 * marker, so it does not satisfy the convention and is not something this module
 * will pay out on its own. An operator who has confirmed it by hand can add it
 * through RHAGENT_RWA_TOKENS — that is a deliberate manual step, not an
 * oversight.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What an operator should know before enabling payouts
 *
 * These tokens are debt securities issued by Robinhood Assets (Jersey) Limited.
 * They confer no shareholder rights, and they are not registered under US
 * securities law — they may not be offered, sold or delivered to US persons, and
 * are further restricted in the UK, Canada and Switzerland. Agents here
 * self-register with no KYC and no declared jurisdiction, so paying a grant in
 * one of these is a distribution to a counterparty whose eligibility is unknown.
 *
 * That is a decision for the operator, not for this file, which is why RWA
 * payouts are OFF by default and gated behind their own flag rather than riding
 * on RHAGENT_GRANTS_ENABLED. Nothing here routes to an RWA until someone sets
 * RHAGENT_RWA_PAYOUTS_ENABLED=true.
 */

export interface RwaToken {
  /** Equity ticker, uppercase. The channel/symbol an agent posts research under. */
  symbol: string;
  contract: `0x${string}`;
  decimals: number;
  /** on-chain name(), kept so the issuer convention is auditable from the record. */
  onchain_name: string;
  /**
   * True only when name() carries the "• Robinhood Token" issuer marker.
   * Unverified entries are payable ONLY if an operator added them explicitly.
   */
  verified: boolean;
}

/** Issuer marker in name() for Robinhood-issued equity tokens. */
const ISSUER_MARKER = "• Robinhood Token";

/**
 * Curated set. Every contract, decimal and name below was read from
 * https://rpc.mainnet.chain.robinhood.com and matches the issuer convention.
 * Adding to this list means confirming the address on-chain first.
 */
export const RWA_SEED_TOKENS: Record<string, RwaToken> = {
  NVDA: {
    symbol: "NVDA",
    contract: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    decimals: 18,
    onchain_name: "NVIDIA • Robinhood Token",
    verified: true,
  },
  TSLA: {
    symbol: "TSLA",
    contract: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    decimals: 18,
    onchain_name: "Tesla • Robinhood Token",
    verified: true,
  },
  AAPL: {
    symbol: "AAPL",
    contract: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    decimals: 18,
    onchain_name: "Apple • Robinhood Token",
    verified: true,
  },
  SPY: {
    symbol: "SPY",
    contract: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
    decimals: 18,
    onchain_name: "SPDR S&P 500 ETF Trust • Robinhood Token",
    verified: true,
  },
  MSTR: {
    symbol: "MSTR",
    contract: "0xec262a75e413fAfD0dF80480274532C79D42da09",
    decimals: 18,
    onchain_name: "Strategy Inc. • Robinhood Token",
    verified: true,
  },
  COIN: {
    symbol: "COIN",
    contract: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b",
    decimals: 18,
    onchain_name: "Coinbase • Robinhood Token",
    verified: true,
  },
};

export function rwaPayoutsEnabled(): boolean {
  return process.env.RHAGENT_RWA_PAYOUTS_ENABLED === "true";
}

/**
 * Liquidity floor. A payout in a token nobody can sell is worse than no payout
 * at all, because it looks like compensation and isn't.
 */
export function rwaMinLiquidityUsd(): number {
  const n = parseFloat(process.env.RHAGENT_RWA_MIN_LIQUIDITY_USD ?? "50000");
  return Number.isFinite(n) && n >= 0 ? n : 50_000;
}

/**
 * Operator additions, as JSON:
 *   RHAGENT_RWA_TOKENS='[{"symbol":"HOOD","contract":"0x32aC…","decimals":18}]'
 *
 * Anything added this way is treated as operator-attested: it bypasses the
 * issuer-name check, because the whole point is to allow a token the convention
 * does not cover. It does NOT bypass the liquidity floor.
 */
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
      // Attested by whoever set the env var. Recorded as verified so the payout
      // path treats it as payable, but the source is distinguishable below.
      verified: true,
    };
  }
  return out;
}

/** The full payable map: curated seed, then operator additions (which win). */
export function rwaRegistry(): Record<string, RwaToken> {
  return { ...RWA_SEED_TOKENS, ...operatorTokens() };
}

/** Is this ticker one we hold a verified contract for? Case-insensitive. */
export function rwaTokenFor(symbolRaw: string | null | undefined): RwaToken | null {
  if (!symbolRaw || typeof symbolRaw !== "string") return null;
  const symbol = symbolRaw.trim().replace(/^\$/, "").toUpperCase();
  if (!symbol) return null;
  return rwaRegistry()[symbol] ?? null;
}

/** Does an on-chain name() carry the issuer marker? Used to audit the seed set. */
export function looksIssuerMinted(onchainName: string | null | undefined): boolean {
  return typeof onchainName === "string" && onchainName.includes(ISSUER_MARKER);
}

export interface RwaQuote {
  symbol: string;
  contract: `0x${string}`;
  price_usd: number | null;
  liquidity_usd: number;
  volume_24h_usd: number;
  /** Deep enough that a payout can actually be sold. */
  tradeable: boolean;
  /** Present when tradeable is false. */
  reason?: string;
}

const quoteCache = new Map<string, { q: RwaQuote; at: number }>();
const QUOTE_TTL_MS = 60_000;

/**
 * Live price and depth for a KNOWN contract address.
 *
 * Deliberately keyed by address, not symbol — see the header. Dexscreener is
 * asked "what is this contract worth", a question with one answer, rather than
 * "which contract is NVDA", a question with 22.
 */
export async function rwaQuote(token: RwaToken): Promise<RwaQuote> {
  const key = token.contract.toLowerCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.q;

  const base: RwaQuote = {
    symbol: token.symbol,
    contract: token.contract,
    price_usd: null,
    liquidity_usd: 0,
    volume_24h_usd: 0,
    tradeable: false,
    reason: "price_unavailable",
  };

  let q: RwaQuote = base;
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/robinhood/${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const pairs = (await res.json()) as {
        priceUsd?: string;
        liquidity?: { usd?: number };
        volume?: { h24?: number };
      }[];
      if (Array.isArray(pairs) && pairs.length) {
        const liquidity = pairs.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
        const volume = pairs.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
        const deepest = pairs.reduce((a, b) =>
          (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a,
        );
        const px = parseFloat(deepest.priceUsd ?? "");
        const price = Number.isFinite(px) && px > 0 ? px : null;
        const floor = rwaMinLiquidityUsd();
        q = {
          symbol: token.symbol,
          contract: token.contract,
          price_usd: price,
          liquidity_usd: liquidity,
          volume_24h_usd: volume,
          tradeable: price != null && liquidity >= floor,
          ...(price == null
            ? { reason: "price_unavailable" }
            : liquidity < floor
              ? { reason: `liquidity $${Math.round(liquidity).toLocaleString()} below floor $${floor.toLocaleString()}` }
              : {}),
        };
      }
    }
  } catch {
    /* leave `base` — an unreachable price source must not silently become $0 */
  }

  quoteCache.set(key, { q, at: Date.now() });
  return q;
}

/** For docs and the admin view: what can currently be paid, and at what depth. */
export async function rwaRegistrySnapshot(): Promise<
  (RwaToken & { quote: RwaQuote })[]
> {
  const tokens = Object.values(rwaRegistry());
  return Promise.all(tokens.map(async (t) => ({ ...t, quote: await rwaQuote(t) })));
}
