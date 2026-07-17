/**
 * Browser-side ETH→token swap on Robinhood Chain via MetaMask (LI.FI / Uniswap route).
 */

import {
  ethRequest,
  ensureRobinhoodChain,
  getEthereum,
  walletErrorMessage,
  type EthereumProvider,
} from "@/lib/browser-ethereum";
import { WETH_RH } from "@/lib/uniswap-v2-constants";

export type SwapQuoteClient = {
  router: string;
  calldata: string;
  valueWei: string;
  amountOut: string;
  amountOutMin: string;
  amountInEth: string;
  notional_usd?: number | null;
  eth_usd?: number | null;
  tokenOut: string;
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

export async function executeEthToTokenSwap(quote: SwapQuoteClient): Promise<SwapResult> {
  const eth = getEthereum();
  if (!eth) {
    throw new Error("MetaMask not found — install MetaMask and refresh.");
  }

  await ensureRobinhoodChain(eth);
  const accounts = await connectedAccounts(eth);
  const from = accounts[0];
  if (!from) throw new Error("No wallet account — unlock MetaMask and try again.");

  const to = quote.router as `0x${string}`;
  if (!to || !/^0x[a-fA-F0-9]{40}$/i.test(to)) {
    throw new Error("Invalid swap router from quote.");
  }

  const txHash = await ethRequest(
    eth,
    {
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to,
          data: quote.calldata,
          value: `0x${BigInt(quote.valueWei).toString(16)}`,
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

export { walletErrorMessage, WETH_RH };
