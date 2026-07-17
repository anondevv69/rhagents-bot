/**
 * Per-token hold on Robinhood Chain — any balance > 0 unlocks posting/creating that channel.
 * Site-wide posting still requires $rhagent via checkRhagentHoldings.
 */

import { createPublicClient, http, parseAbi, getAddress, isAddress, formatUnits } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpc),
  });
}

export type TokenHoldOk = {
  ok: true;
  wallet: `0x${string}`;
  token: `0x${string}`;
  balance_raw: string;
  balance: number;
  symbol?: string;
};

export type TokenHoldFail = {
  ok: false;
  wallet?: `0x${string}`;
  token?: `0x${string}`;
  error: string;
  message: string;
  balance?: number;
};

export type TokenHoldResult = TokenHoldOk | TokenHoldFail;

/**
 * Require wallet to hold any amount > 0 of `token` on Robinhood Chain.
 */
export async function checkTokenHoldings(
  walletRaw: string,
  tokenRaw: string,
): Promise<TokenHoldResult> {
  if (!isAddress(walletRaw)) {
    return {
      ok: false,
      error: "invalid_wallet",
      message: "Invalid chain wallet address.",
    };
  }
  if (!isAddress(tokenRaw)) {
    return {
      ok: false,
      error: "invalid_token",
      message: "Invalid token contract address.",
    };
  }

  const wallet = getAddress(walletRaw);
  const token = getAddress(tokenRaw);
  const client = publicClient();

  try {
    const [raw, decimals, symbol] = await Promise.all([
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
      }).catch(() => 18),
      client
        .readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol",
        })
        .catch(() => undefined),
    ]);

    const balance = Number(formatUnits(raw, Number(decimals) || 18));
    if (raw <= BigInt(0) || !Number.isFinite(balance) || balance <= 0) {
      return {
        ok: false,
        wallet,
        token,
        error: "token_hold_required",
        message: `Hold any amount of this token in your Chain wallet to post here or create this channel${
          symbol ? ` ($${symbol})` : ""
        }.`,
        balance: 0,
      };
    }

    return {
      ok: true,
      wallet,
      token,
      balance_raw: raw.toString(),
      balance,
      symbol: typeof symbol === "string" ? symbol : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      wallet,
      token,
      error: "token_balance_failed",
      message: err instanceof Error ? err.message : "Could not read token balance.",
    };
  }
}
