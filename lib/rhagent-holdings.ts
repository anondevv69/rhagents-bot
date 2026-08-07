/**
 * $rhagent holdings gate on Robinhood Chain.
 * Pass if balance ≥ 1,000,000 tokens OR USD value ≥ $10.
 */

import { createPublicClient, http, parseAbi, formatUnits, isAddress, getAddress } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import {
  RHAGENT_TOKEN_CONTRACT,
  RHAGENT_DEXSCREENER_URL,
  RHAGENT_TOKEN_SYMBOL,
} from "@/lib/rhagent-token";

export const RHAGENT_MIN_TOKENS = 1_000_000;
export const RHAGENT_MIN_USD = 10;

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

export type HoldCheckOk = {
  ok: true;
  wallet: `0x${string}`;
  balance_tokens: number;
  balance_raw: string;
  price_usd: number | null;
  value_usd: number | null;
  passed_via: "token_amount" | "usd_value";
};

export type HoldCheckFail = {
  ok: false;
  wallet?: `0x${string}`;
  error: string;
  balance_tokens?: number;
  value_usd?: number | null;
  buy_url: string;
  requirement: {
    min_tokens: number;
    min_usd: number;
    token: string;
    contract: string;
  };
};

export type HoldCheckResult = HoldCheckOk | HoldCheckFail;

export function normalizeChainWallet(raw: string): `0x${string}` | null {
  const s = raw.trim();
  if (!isAddress(s)) return null;
  return getAddress(s);
}

export async function fetchTokenPriceUsd(contract: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contract.toLowerCase()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pairs?: { priceUsd?: string; chainId?: string; liquidity?: { usd?: number } }[];
    };
    const pairs = data.pairs ?? [];
    // Prefer Robinhood Chain / highest liquidity
    const ranked = [...pairs].sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );
    const rh = ranked.find((p) => /robinhood/i.test(String(p.chainId ?? "")));
    const pick = rh ?? ranked[0];
    const n = parseFloat(pick?.priceUsd ?? "");
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function checkRhagentHoldings(walletRaw: string): Promise<HoldCheckResult> {
  const wallet = normalizeChainWallet(walletRaw);
  const requirement = {
    min_tokens: RHAGENT_MIN_TOKENS,
    min_usd: RHAGENT_MIN_USD,
    token: RHAGENT_TOKEN_SYMBOL,
    contract: RHAGENT_TOKEN_CONTRACT,
  };
  const buy_url = RHAGENT_DEXSCREENER_URL;

  if (!wallet) {
    return { ok: false, error: "Invalid chain_wallet address", buy_url, requirement };
  }

  const token = RHAGENT_TOKEN_CONTRACT as `0x${string}`;
  const client = publicClient();

  try {
    const [rawBalance, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    const balanceTokens = Number(formatUnits(rawBalance, decimals));
    const priceUsd = await fetchTokenPriceUsd(RHAGENT_TOKEN_CONTRACT);
    const valueUsd =
      priceUsd != null && Number.isFinite(balanceTokens)
        ? balanceTokens * priceUsd
        : null;

    if (balanceTokens >= RHAGENT_MIN_TOKENS) {
      return {
        ok: true,
        wallet,
        balance_tokens: balanceTokens,
        balance_raw: rawBalance.toString(),
        price_usd: priceUsd,
        value_usd: valueUsd,
        passed_via: "token_amount",
      };
    }

    if (valueUsd != null && valueUsd >= RHAGENT_MIN_USD) {
      return {
        ok: true,
        wallet,
        balance_tokens: balanceTokens,
        balance_raw: rawBalance.toString(),
        price_usd: priceUsd,
        value_usd: valueUsd,
        passed_via: "usd_value",
      };
    }

    return {
      ok: false,
      wallet,
      error: `Wallet holds ${balanceTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${RHAGENT_TOKEN_SYMBOL} (≈$${valueUsd?.toFixed(2) ?? "?"}) — need ≥${RHAGENT_MIN_TOKENS.toLocaleString()} tokens or ≈$${RHAGENT_MIN_USD} USD value`,
      balance_tokens: balanceTokens,
      value_usd: valueUsd,
      buy_url,
      requirement,
    };
  } catch (e) {
    return {
      ok: false,
      wallet,
      error: `Could not read ${RHAGENT_TOKEN_SYMBOL} balance: ${e instanceof Error ? e.message : "rpc_error"}`,
      buy_url,
      requirement,
    };
  }
}

export function holdFailResponse(hold: HoldCheckFail) {
  return {
    ok: false as const,
    reason: "buy_rhagent_required" as const,
    error: hold.error,
    buy_url: hold.buy_url,
    requirement: hold.requirement,
    balance_tokens: hold.balance_tokens ?? null,
    value_usd: hold.value_usd ?? null,
    setup: "https://rhagent.bot/docs#chain",
    message: `Buy ${RHAGENT_TOKEN_SYMBOL} on Robinhood Chain, then retry. Need ≥${RHAGENT_MIN_TOKENS.toLocaleString()} tokens or ≈$${RHAGENT_MIN_USD}.`,
  };
}
