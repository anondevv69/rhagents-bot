/**
 * Robinhood Chain swaps for the web wallet UI (buy ETH→token, sell token→ETH).
 * Quotes + calldata via OpenOcean (Uniswap V4 routes on chain 4663).
 */

import {
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { createPublicClient, http, parseAbi } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { WETH_RH } from "@/lib/uniswap-v2-constants";

export { WETH_RH };

const OO_BASE = "https://open-api.openocean.finance/v4/4663";
/** OpenOcean native ETH sentinel. */
export const OO_NATIVE_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export type SwapSide = "buy" | "sell";

export type ChainSwapQuote = {
  ok: true;
  side: SwapSide;
  router: Address;
  token: Address;
  /** Human-readable amount of the input asset (ETH for buy, token for sell). */
  amountIn: string;
  amountInRaw: string;
  /** Human-readable amount of the output asset. */
  amountOut: string;
  amountOutRaw: string;
  amountOutMin: string;
  amountOutMinRaw: string;
  /** ETH received (sell) or spent (buy), human-readable. */
  amountEth: string;
  /** Tokens received (buy) or sold (sell), human-readable. */
  amountToken: string;
  slippage_bps: number;
  deadline: number;
  calldata: Hex;
  valueWei: string;
  /** Spender that needs ERC-20 allowance on sells (usually router). */
  approval_to: Address | null;
  tool?: string;
};

export type ChainSwapQuoteFail = {
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

async function tokenDecimals(token: Address): Promise<number> {
  try {
    const d = Number(
      await publicClient().readContract({
        address: token,
        abi: parseAbi(["function decimals() view returns (uint8)"]),
        functionName: "decimals",
      }),
    );
    return Number.isFinite(d) && d >= 0 && d <= 36 ? d : 18;
  } catch {
    return 18;
  }
}

type OoSwapResponse = {
  code?: number;
  data?: {
    inAmount?: string;
    outAmount?: string;
    minOutAmount?: string;
    to?: string;
    value?: string | number;
    data?: string;
    estimatedGas?: string | number;
  };
  message?: string;
};

/**
 * Call OpenOcean, and never let a transport failure surface as a parse error.
 *
 * This used to do `await res.json()` BEFORE checking `res.ok`. When something
 * upstream returns a non-JSON error body — production currently gets a bare
 * `Forbidden;`, which is a proxy/WAF response and not OpenOcean's own format,
 * since theirs is always JSON — `json()` throws `Unexpected token 'F'`, the
 * exception escapes, and the user is shown a JavaScript parse error where a
 * reason should be. The failure was real, but the message described our parser
 * instead of their block.
 *
 * So: read the body as text once, decide based on status and shape, and always
 * return something a person can act on.
 */
async function openOceanSwap(params: URLSearchParams): Promise<OoSwapResponse> {
  const res = await fetch(`${OO_BASE}/swap?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  const raw = await res.text();
  let data: OoSwapResponse | null = null;
  try {
    data = JSON.parse(raw) as OoSwapResponse;
  } catch {
    /* not JSON — handled below */
  }

  if (!res.ok || !data) {
    // A 403 with a non-JSON body is almost always an egress block rather than
    // anything wrong with the swap, so say that rather than blaming the token.
    const blocked = res.status === 403 || /forbidden/i.test(raw);
    return {
      code: res.status || 502,
      message: blocked
        ? "Swap quotes are blocked from this server right now (upstream returned 403). " +
          "This is a connectivity problem, not a problem with the token."
        : data?.message || `Quote service returned HTTP ${res.status}.`,
    };
  }

  return data;
}

/**
 * Quote + build calldata: native ETH → ERC-20 (buy) or ERC-20 → native ETH (sell).
 */
export async function quoteChainSwap(input: {
  side: SwapSide;
  token: string;
  /** ETH amount for buys (e.g. "0.001"). */
  amountEth?: string;
  /** Token amount for sells (human units, e.g. "1000"). */
  amountToken?: string;
  recipient: string;
  slippageBps?: number;
}): Promise<ChainSwapQuote | ChainSwapQuoteFail> {
  if (!isAddress(input.token)) {
    return { ok: false, error: "invalid_token", message: "token must be a 0x address" };
  }
  if (!isAddress(input.recipient)) {
    return { ok: false, error: "invalid_recipient", message: "recipient must be a 0x address" };
  }

  const token = getAddress(input.token) as Address;
  const recipient = getAddress(input.recipient) as Address;
  const slippageBps = input.slippageBps ?? 100;
  const slippagePct = Math.max(0.1, Math.min(5, slippageBps / 100));
  const decimals = await tokenDecimals(token);

  let amountParam: string;
  let amountInRaw: bigint;

  if (input.side === "buy") {
    const eth = Number(input.amountEth);
    if (!Number.isFinite(eth) || eth <= 0) {
      return { ok: false, error: "invalid_amount", message: "amountEth must be > 0" };
    }
    if (eth > 10) {
      return { ok: false, error: "amount_too_large", message: "Max 10 ETH per web buy for safety." };
    }
    try {
      amountInRaw = parseEther(String(input.amountEth).trim());
    } catch {
      return { ok: false, error: "invalid_amount", message: "Could not parse ETH amount" };
    }
    if (amountInRaw < parseEther("0.0001")) {
      return { ok: false, error: "amount_too_small", message: "Minimum buy is 0.0001 ETH." };
    }
    // OpenOcean expects human ETH amount (e.g. 0.001), not wei.
    amountParam = String(input.amountEth).trim();
  } else {
    const tok = Number(input.amountToken);
    if (!Number.isFinite(tok) || tok <= 0) {
      return { ok: false, error: "invalid_amount", message: "amountToken must be > 0" };
    }
    try {
      amountInRaw = parseUnits(String(input.amountToken).trim(), decimals);
    } catch {
      return { ok: false, error: "invalid_amount", message: "Could not parse token amount" };
    }
    if (amountInRaw <= BigInt(0)) {
      return { ok: false, error: "amount_too_small", message: "Token amount too small." };
    }
    amountParam = String(input.amountToken).trim();
  }

  const params = new URLSearchParams({
    inTokenAddress: input.side === "buy" ? OO_NATIVE_ETH : token,
    outTokenAddress: input.side === "buy" ? token : OO_NATIVE_ETH,
    amount: amountParam,
    gasPrice: "0.001",
    slippage: String(slippagePct),
    account: recipient,
  });

  let oo: OoSwapResponse;
  try {
    oo = await openOceanSwap(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "quote_failed", message: `Quote request failed: ${msg.slice(0, 160)}` };
  }

  if (oo.code !== 200 || !oo.data?.to || !oo.data.data) {
    return {
      ok: false,
      error: "no_route",
      message:
        oo.message ||
        "No swap route found for this token on Robinhood Chain (need Uniswap liquidity).",
    };
  }

  const outRaw = BigInt(oo.data.outAmount || "0");
  const minOutRaw = BigInt(oo.data.minOutAmount || oo.data.outAmount || "0");
  if (outRaw <= BigInt(0)) {
    return {
      ok: false,
      error: "no_liquidity",
      message: "Quote returned 0 — try a different amount.",
    };
  }

  const inRaw = BigInt(oo.data.inAmount || amountInRaw.toString());
  const valueWei =
    input.side === "buy"
      ? (typeof oo.data.value === "string" && oo.data.value.startsWith("0x")
          ? BigInt(oo.data.value).toString()
          : String(oo.data.value ?? inRaw.toString()))
      : "0";

  const amountEth =
    input.side === "buy"
      ? formatUnits(inRaw, 18)
      : formatUnits(outRaw, 18);
  const amountToken =
    input.side === "buy"
      ? formatUnits(outRaw, decimals)
      : formatUnits(inRaw, decimals);

  const router = getAddress(oo.data.to) as Address;

  return {
    ok: true,
    side: input.side,
    router,
    token,
    amountIn: input.side === "buy" ? amountEth : amountToken,
    amountInRaw: inRaw.toString(),
    amountOut: input.side === "buy" ? amountToken : amountEth,
    amountOutRaw: outRaw.toString(),
    amountOutMin: input.side === "buy" ? formatUnits(minOutRaw, decimals) : formatUnits(minOutRaw, 18),
    amountOutMinRaw: minOutRaw.toString(),
    amountEth,
    amountToken,
    slippage_bps: slippageBps,
    deadline: Math.floor(Date.now() / 1000) + 20 * 60,
    calldata: oo.data.data as Hex,
    valueWei,
    approval_to: input.side === "sell" ? router : null,
    tool: "openocean",
  };
}

/** @deprecated use quoteChainSwap({ side: "buy", ... }) */
export async function quoteEthToToken(input: {
  tokenOut: string;
  amountInEth: string;
  recipient: string;
  slippageBps?: number;
}): Promise<
  | (Omit<ChainSwapQuote, "side" | "token" | "amountIn" | "amountInRaw" | "amountEth" | "amountToken" | "approval_to"> & {
      ok: true;
      tokenOut: Address;
      amountInEth: string;
      amountInWei: string;
    })
  | ChainSwapQuoteFail
> {
  const q = await quoteChainSwap({
    side: "buy",
    token: input.tokenOut,
    amountEth: input.amountInEth,
    recipient: input.recipient,
    slippageBps: input.slippageBps,
  });
  if (!q.ok) return q;
  return {
    ok: true,
    router: q.router,
    tokenOut: q.token,
    amountInEth: q.amountEth,
    amountInWei: q.amountInRaw,
    amountOut: q.amountOut,
    amountOutRaw: q.amountOutRaw,
    amountOutMin: q.amountOutMin,
    amountOutMinRaw: q.amountOutMinRaw,
    slippage_bps: q.slippage_bps,
    deadline: q.deadline,
    calldata: q.calldata,
    valueWei: q.valueWei,
    tool: q.tool,
  };
}

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

export async function fetchTokenBalance(wallet: string, token: string): Promise<{
  ok: true;
  balance: string;
  balanceRaw: string;
  decimals: number;
} | { ok: false; error: string }> {
  if (!isAddress(wallet) || !isAddress(token)) {
    return { ok: false, error: "invalid_address" };
  }
  const client = publicClient();
  const tokenAddr = getAddress(token) as Address;
  const owner = getAddress(wallet) as Address;
  const decimals = await tokenDecimals(tokenAddr);
  try {
    const raw = await client.readContract({
      address: tokenAddr,
      abi: parseAbi(["function balanceOf(address) view returns (uint256)"]),
      functionName: "balanceOf",
      args: [owner],
    });
    return {
      ok: true,
      balance: formatUnits(raw, decimals),
      balanceRaw: raw.toString(),
      decimals,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "balance_failed" };
  }
}
