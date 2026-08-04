/**
 * Browser-side swap on Robinhood Chain via MetaMask (OpenOcean / Uniswap route).
 * Buys send ETH; sells approve ERC-20 then swap to ETH.
 */

import {
  ethRequest,
  ensureRobinhoodChain,
  getEthereum,
  walletErrorMessage,
  type EthereumProvider,
} from "@/lib/browser-ethereum";
import { WETH_RH } from "@/lib/uniswap-v2-constants";
import { encodeFunctionData, maxUint256, parseAbi } from "viem";

export type SwapQuoteClient = {
  router: string;
  calldata: string;
  valueWei: string;
  amountOut: string;
  amountOutMin: string;
  amountInEth?: string;
  amountEth?: string;
  amountToken?: string;
  amountIn?: string;
  amountInRaw?: string;
  side?: "buy" | "sell";
  token?: string;
  tokenOut?: string;
  approval_to?: string | null;
  notional_usd?: number | null;
  eth_usd?: number | null;
};

export type SwapResult = {
  txHash: `0x${string}`;
  from: string;
};

async function connectedAccounts(eth: EthereumProvider): Promise<string[]> {
  const acc = await ethRequest(
    eth,
    { method: "eth_requestAccounts" },
    "Timed out connecting wallet — check MetaMask.",
  );
  return Array.isArray(acc) ? (acc as string[]) : [];
}

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

async function ensureErc20Approval(input: {
  eth: EthereumProvider;
  from: string;
  token: string;
  spender: string;
  amountRaw: bigint;
}): Promise<void> {
  const { eth, from, token, spender, amountRaw } = input;
  const allowanceData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [from as `0x${string}`, spender as `0x${string}`],
  });
  const allowanceHex = await ethRequest(
    eth,
    { method: "eth_call", params: [{ to: token, data: allowanceData }, "latest"] },
    "Timed out reading token allowance.",
  );
  const allowance =
    typeof allowanceHex === "string" && allowanceHex.startsWith("0x")
      ? BigInt(allowanceHex)
      : BigInt(0);
  if (allowance >= amountRaw) return;

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender as `0x${string}`, maxUint256],
  });
  const approveHash = await ethRequest(
    eth,
    {
      method: "eth_sendTransaction",
      params: [{ from, to: token, data: approveData }],
    },
    "Timed out waiting for token approve in MetaMask.",
  );
  if (typeof approveHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(approveHash)) {
    throw new Error("Approve did not return a transaction hash.");
  }

  // Wait for approval to be mined (best-effort poll).
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const receipt = await ethRequest(
      eth,
      { method: "eth_getTransactionReceipt", params: [approveHash] },
      "Timed out waiting for approve receipt.",
    );
    if (receipt && typeof receipt === "object" && "status" in receipt) {
      const status = String((receipt as { status?: string }).status);
      if (status === "0x1" || status === "1") return;
      if (status === "0x0" || status === "0") {
        throw new Error("Token approve transaction failed.");
      }
    }
  }
}

export async function executeChainSwap(
  quote: SwapQuoteClient,
  opts?: { onStatus?: (msg: string) => void; provider?: EthereumProvider; fromAddress?: string },
): Promise<SwapResult> {
  const eth = opts?.provider ?? getEthereum();
  if (!eth) {
    throw new Error("No wallet found — connect Privy or install MetaMask.");
  }

  await ensureRobinhoodChain(eth);
  const accounts = opts?.fromAddress
    ? [opts.fromAddress]
    : await connectedAccounts(eth);
  const from = accounts[0];
  if (!from) throw new Error("No wallet account — unlock your wallet and try again.");

  const to = quote.router as `0x${string}`;
  if (!to || !/^0x[a-fA-F0-9]{40}$/i.test(to)) {
    throw new Error("Invalid swap router from quote.");
  }

  if (quote.side === "sell") {
    const token = (quote.token || quote.tokenOut || "").trim();
    const spender = (quote.approval_to || quote.router || "").trim();
    const amountRaw = BigInt(quote.amountInRaw || "0");
    if (!token || !/^0x[a-fA-F0-9]{40}$/i.test(token)) {
      throw new Error("Missing token for sell approval.");
    }
    if (!spender || !/^0x[a-fA-F0-9]{40}$/i.test(spender)) {
      throw new Error("Missing spender for sell approval.");
    }
    if (amountRaw <= BigInt(0)) {
      throw new Error("Invalid sell amount.");
    }
    opts?.onStatus?.("Approve token in wallet…");
    await ensureErc20Approval({ eth, from, token, spender, amountRaw });
  }

  opts?.onStatus?.("Confirm swap in wallet…");
  const valueWei = BigInt(quote.valueWei || "0");
  const txHash = await ethRequest(
    eth,
    {
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to,
          data: quote.calldata,
          value: `0x${valueWei.toString(16)}`,
        },
      ],
    },
    "Timed out waiting for swap confirmation in MetaMask.",
  );

  if (typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    throw new Error("Wallet did not return a transaction hash.");
  }

  return { txHash: txHash as `0x${string}`, from };
}

/** @deprecated use executeChainSwap */
export async function executeEthToTokenSwap(quote: SwapQuoteClient): Promise<SwapResult> {
  return executeChainSwap({ ...quote, side: quote.side ?? "buy" });
}

export { walletErrorMessage, WETH_RH };
