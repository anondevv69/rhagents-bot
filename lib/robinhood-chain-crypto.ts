/**
 * Enforce Chain tickers are real Robinhood Chain crypto tokens —
 * not App Crypto pairs, not stock tokens on other chains, not random 0x spam.
 */

import { getAddress, isAddress, createPublicClient, http } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";

const HOODMARKETS_API = process.env.HOODMARKETS_API_URL || "https://api.hood.markets";

export type ChainCryptoOk = {
  ok: true;
  contract: `0x${string}`;
  source: "seed" | "dexscreener_robinhood" | "hoodmarkets";
  symbol_hint?: string;
};

export type ChainCryptoFail = {
  ok: false;
  error: string;
  hint: string;
};

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

/** $RHAGENT is always allowed. */
export function isSeedChainCrypto(contract: string): boolean {
  if (!isAddress(contract)) return false;
  return getAddress(contract).toLowerCase() === RHAGENT_TOKEN_CONTRACT.toLowerCase();
}

async function hasCodeOnRobinhoodChain(contract: `0x${string}`): Promise<boolean> {
  try {
    const code = await publicClient().getBytecode({ address: contract });
    return !!code && code !== "0x";
  } catch {
    return false;
  }
}

async function listedOnDexScreenerRobinhood(
  contract: string
): Promise<{ ok: true; symbol?: string } | { ok: false }> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contract.toLowerCase()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      pairs?: {
        chainId?: string;
        baseToken?: { address?: string; symbol?: string };
        quoteToken?: { address?: string; symbol?: string };
      }[];
    };
    const pairs = data.pairs ?? [];
    const rh = pairs.find((p) => {
      const chain = String(p.chainId ?? "").toLowerCase();
      if (chain !== "robinhood" && !chain.includes("robinhood")) return false;
      const base = (p.baseToken?.address ?? "").toLowerCase();
      const quote = (p.quoteToken?.address ?? "").toLowerCase();
      const c = contract.toLowerCase();
      return base === c || quote === c;
    });
    if (!rh) return { ok: false };
    const sym =
      rh.baseToken?.address?.toLowerCase() === contract.toLowerCase()
        ? rh.baseToken?.symbol
        : rh.quoteToken?.symbol;
    return { ok: true, symbol: sym };
  } catch {
    return { ok: false };
  }
}

async function listedOnHoodmarkets(
  contract: string
): Promise<{ ok: true; symbol?: string } | { ok: false }> {
  try {
    const res = await fetch(`${HOODMARKETS_API}/api/deployments/${contract}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as {
      error?: string;
      deployment?: { tokenSymbol?: string; chain?: string; tokenAddress?: string };
    };
    if (data.error || !data.deployment) return { ok: false };
    const chain = String(data.deployment.chain ?? "").toLowerCase();
    if (chain && chain !== "robinhood") return { ok: false };
    return { ok: true, symbol: data.deployment.tokenSymbol };
  } catch {
    return { ok: false };
  }
}

/**
 * Validate a contract is a Robinhood Chain crypto token we allow as a Chain ticker.
 * Pass: seed ($RHAGENT), DexScreener robinhood pair, or hood.markets catalog.
 */
export async function assertRobinhoodChainCryptoToken(
  contractRaw: string
): Promise<ChainCryptoOk | ChainCryptoFail> {
  if (!isAddress(contractRaw)) {
    return {
      ok: false,
      error: "invalid_contract",
      hint: "Chain tickers require a Robinhood Chain ERC-20 contract (0x…).",
    };
  }
  const contract = getAddress(contractRaw) as `0x${string}`;

  if (isSeedChainCrypto(contract)) {
    return { ok: true, contract, source: "seed", symbol_hint: "RHAGENT" };
  }

  const onChain = await hasCodeOnRobinhoodChain(contract);
  if (!onChain) {
    return {
      ok: false,
      error: "not_on_robinhood_chain",
      hint: "Contract has no code on Robinhood Chain (4663). Only Robinhood Chain crypto tokens are allowed — not App Crypto pairs or other L1/L2 tokens.",
    };
  }

  const dex = await listedOnDexScreenerRobinhood(contract);
  if (dex.ok) {
    return { ok: true, contract, source: "dexscreener_robinhood", symbol_hint: dex.symbol };
  }

  const hood = await listedOnHoodmarkets(contract);
  if (hood.ok) {
    return { ok: true, contract, source: "hoodmarkets", symbol_hint: hood.symbol };
  }

  return {
    ok: false,
    error: "not_robinhood_chain_crypto",
    hint: "Only Robinhood Chain crypto tokens are allowed as Chain tickers (listed on DexScreener chain=robinhood, hood.markets catalog, or $RHAGENT). App Crypto (DOGE-USD) and Agentic stocks use their own products.",
  };
}
