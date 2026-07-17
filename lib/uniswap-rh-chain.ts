/**
 * Robinhood Chain token buys for the web wallet UI.
 * Quotes + calldata via LI.FI (routes Uniswap V4 / V3 / V2 on chain 4663).
 */

import {
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { createPublicClient, http, parseAbi } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { WETH_RH } from "@/lib/uniswap-v2-constants";

export { WETH_RH };

const LIFI_QUOTE = "https://li.quest/v1/quote";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

export type EthToTokenQuote = {
  ok: true;
  router: Address;
  tokenOut: Address;
  amountInEth: string;
  amountInWei: string;
  amountOut: string;
  amountOutRaw: string;
  amountOutMin: string;
  amountOutMinRaw: string;
  slippage_bps: number;
  deadline: number;
  calldata: Hex;
  valueWei: string;
  tool?: string;
  route_id?: string;
};

export type EthToTokenQuoteFail = {
  ok: false;
  error: string;
  message: string;
};

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

type LifiQuoteResponse = {
  id?: string;
  tool?: string;
  estimate?: {
    toAmount?: string;
    toAmountMin?: string;
    toToken?: { decimals?: number; address?: string };
  };
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
  };
  message?: string;
  code?: string | number;
};

/**
 * Quote native ETH → ERC-20 on Robinhood Chain and return wallet calldata.
 */
export async function quoteEthToToken(input: {
  tokenOut: string;
  amountInEth: string;
  recipient: string;
  slippageBps?: number;
}): Promise<EthToTokenQuote | EthToTokenQuoteFail> {
  if (!isAddress(input.tokenOut)) {
    return { ok: false, error: "invalid_token", message: "tokenOut must be a 0x address" };
  }
  if (!isAddress(input.recipient)) {
    return { ok: false, error: "invalid_recipient", message: "recipient must be a 0x address" };
  }

  const eth = Number(input.amountInEth);
  if (!Number.isFinite(eth) || eth <= 0) {
    return { ok: false, error: "invalid_amount", message: "amountInEth must be > 0" };
  }
  if (eth > 10) {
    return { ok: false, error: "amount_too_large", message: "Max 10 ETH per web buy for safety." };
  }

  let amountIn: bigint;
  try {
    amountIn = parseEther(input.amountInEth.trim());
  } catch {
    return { ok: false, error: "invalid_amount", message: "Could not parse ETH amount" };
  }
  if (amountIn < parseEther("0.0001")) {
    return {
      ok: false,
      error: "amount_too_small",
      message: "Minimum buy is 0.0001 ETH.",
    };
  }

  const tokenOut = getAddress(input.tokenOut) as Address;
  const recipient = getAddress(input.recipient) as Address;
  const slippageBps = input.slippageBps ?? 100;
  const slippagePct = Math.max(0.1, Math.min(5, slippageBps / 100));

  const params = new URLSearchParams({
    fromChain: "4663",
    toChain: "4663",
    fromToken: NATIVE_ETH,
    toToken: tokenOut,
    fromAmount: amountIn.toString(),
    fromAddress: recipient,
    toAddress: recipient,
    slippage: String(slippagePct / 100), // LI.FI expects fraction (0.01 = 1%)
  });

  let data: LifiQuoteResponse;
  try {
    const res = await fetch(`${LIFI_QUOTE}?${params}`, {
      headers: {
        Accept: "application/json",
        ...(process.env.LIFI_API_KEY
          ? { "x-lifi-api-key": process.env.LIFI_API_KEY }
          : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    data = (await res.json()) as LifiQuoteResponse;
    if (!res.ok) {
      return {
        ok: false,
        error: "quote_failed",
        message: data.message || `LI.FI quote failed (${res.status})`,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "quote_failed", message: `Quote request failed: ${msg.slice(0, 160)}` };
  }

  const tx = data.transactionRequest;
  if (!tx?.to || !tx.data || !/^0x[a-fA-F0-9]+$/.test(tx.data)) {
    return {
      ok: false,
      error: "no_route",
      message:
        data.message ||
        "No swap route found for this token on Robinhood Chain (need Uniswap liquidity).",
    };
  }

  const amountOutRaw = BigInt(data.estimate?.toAmount || "0");
  const amountOutMinRaw = BigInt(data.estimate?.toAmountMin || data.estimate?.toAmount || "0");
  if (amountOutRaw <= BigInt(0)) {
    return {
      ok: false,
      error: "no_liquidity",
      message: "Quote returned 0 tokens — try a different amount.",
    };
  }

  let decimals = data.estimate?.toToken?.decimals ?? 18;
  if (!Number.isFinite(decimals)) {
    try {
      decimals = Number(
        await publicClient().readContract({
          address: tokenOut,
          abi: parseAbi(["function decimals() view returns (uint8)"]),
          functionName: "decimals",
        }),
      );
    } catch {
      decimals = 18;
    }
  }

  const valueWei =
    tx.value && tx.value.startsWith("0x")
      ? BigInt(tx.value).toString()
      : amountIn.toString();

  return {
    ok: true,
    router: getAddress(tx.to) as Address,
    tokenOut,
    amountInEth: formatUnits(amountIn, 18),
    amountInWei: amountIn.toString(),
    amountOut: formatUnits(amountOutRaw, decimals),
    amountOutRaw: amountOutRaw.toString(),
    amountOutMin: formatUnits(amountOutMinRaw, decimals),
    amountOutMinRaw: amountOutMinRaw.toString(),
    slippage_bps: slippageBps,
    deadline: Math.floor(Date.now() / 1000) + 20 * 60,
    calldata: tx.data as Hex,
    valueWei,
    tool: data.tool,
    route_id: data.id,
  };
}

/** Best-effort ETH/USD for fill notional — DexScreener WETH on Robinhood. */
export async function fetchEthUsd(): Promise<number | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${WETH_RH}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      pairs?: Array<{ chainId?: string; priceUsd?: string }>;
    };
    const pair =
      body.pairs?.find((p) => /robinhood/i.test(String(p.chainId ?? ""))) ?? body.pairs?.[0];
    const n = pair?.priceUsd ? parseFloat(pair.priceUsd) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
