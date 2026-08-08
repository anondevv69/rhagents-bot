import { createPublicClient, formatEther, getAddress, http, isAddress } from "viem";
import { robinhoodChain } from "@/lib/onchain-config";
import { checkRhagentHoldings } from "@/lib/rhagent-holdings";
import {
  fetchBankrRobinhoodChainPortfolio,
  type BankrPortfolioSummary,
} from "@/lib/bankr";

export interface RobinhoodChainWalletView {
  wallet: string;
  total_usd: number | null;
  eth_balance: string | null;
  rhagent_tokens: number | null;
  rhagent_value_usd: number | null;
  /** Token lines on Robinhood Chain (Bankr portfolio and/or on-chain). */
  tokens: { symbol: string; usd: number; chain?: string; balance?: string }[];
  from_bankr: boolean;
  from_onchain: boolean;
}

function publicClient() {
  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  return createPublicClient({ chain: robinhoodChain, transport: http(rpc) });
}

function isRobinhoodChainName(chain?: string): boolean {
  if (!chain) return false;
  const c = chain.toLowerCase();
  return c.includes("robinhood") || c === "rh" || c === "4663";
}

function robinhoodOnlyFromBankr(summary: BankrPortfolioSummary | null): BankrPortfolioSummary | null {
  if (!summary) return null;
  const tokens = summary.top_holdings.filter(
    (h) => !h.chain || isRobinhoodChainName(h.chain),
  );
  const total =
    summary.robinhood_chain_usd ??
    (tokens.length ? tokens.reduce((s, t) => s + t.usd, 0) : summary.total_usd);
  return {
    total_usd: total,
    chains: summary.chains.filter(isRobinhoodChainName),
    top_holdings: tokens,
    robinhood_chain_usd: total,
  };
}

/** On-chain ETH + $RHAGENT for a Robinhood Chain wallet (no Bankr key needed). */
export async function readRobinhoodChainOnchain(
  walletRaw: string,
): Promise<Pick<RobinhoodChainWalletView, "eth_balance" | "rhagent_tokens" | "rhagent_value_usd">> {
  if (!isAddress(walletRaw)) {
    return { eth_balance: null, rhagent_tokens: null, rhagent_value_usd: null };
  }
  const wallet = getAddress(walletRaw);
  let eth_balance: string | null = null;
  try {
    const wei = await publicClient().getBalance({ address: wallet });
    eth_balance = formatEther(wei);
  } catch {
    eth_balance = null;
  }

  let rhagent_tokens: number | null = null;
  let rhagent_value_usd: number | null = null;
  try {
    const hold = await checkRhagentHoldings(wallet);
    if (hold.ok) {
      rhagent_tokens = hold.balance_tokens;
      rhagent_value_usd = hold.value_usd;
    }
  } catch {
    /* optional */
  }

  return { eth_balance, rhagent_tokens, rhagent_value_usd };
}

/**
 * Robinhood Chain view for a Bankr-linked EVM wallet — Bankr portfolio (robinhood chain only)
 * plus on-chain ETH / $RHAGENT fallback.
 */
export async function buildRobinhoodChainWalletView(
  walletRaw: string,
  bankrApiKey?: string | null,
): Promise<RobinhoodChainWalletView | null> {
  if (!isAddress(walletRaw)) return null;
  const wallet = getAddress(walletRaw).toLowerCase();

  let bankrRh: BankrPortfolioSummary | null = null;
  if (bankrApiKey?.trim()) {
    bankrRh = robinhoodOnlyFromBankr(await fetchBankrRobinhoodChainPortfolio(bankrApiKey.trim()));
  }

  const onchain = await readRobinhoodChainOnchain(wallet);

  const tokens: RobinhoodChainWalletView["tokens"] = [];
  if (bankrRh?.top_holdings.length) {
    for (const h of bankrRh.top_holdings) {
      tokens.push({ symbol: h.symbol, usd: h.usd, chain: h.chain ?? "robinhood" });
    }
  }

  if (onchain.eth_balance && parseFloat(onchain.eth_balance) > 0) {
    const exists = tokens.some((t) => t.symbol === "ETH");
    if (!exists) {
      tokens.push({ symbol: "ETH", usd: 0, chain: "robinhood", balance: onchain.eth_balance });
    }
  }
  if (onchain.rhagent_tokens != null && onchain.rhagent_tokens > 0) {
    const exists = tokens.some((t) => t.symbol === "RHAGENT" || t.symbol === "$RHAGENT");
    if (!exists) {
      tokens.push({
        symbol: "RHAGENT",
        usd: onchain.rhagent_value_usd ?? 0,
        chain: "robinhood",
        balance: String(onchain.rhagent_tokens),
      });
    }
  }

  const total_usd =
    bankrRh?.robinhood_chain_usd ??
    bankrRh?.total_usd ??
    (onchain.rhagent_value_usd != null && onchain.rhagent_value_usd > 0
      ? onchain.rhagent_value_usd
      : null);

  return {
    wallet,
    total_usd,
    eth_balance: onchain.eth_balance,
    rhagent_tokens: onchain.rhagent_tokens,
    rhagent_value_usd: onchain.rhagent_value_usd,
    tokens,
    from_bankr: Boolean(bankrRh),
    from_onchain: Boolean(onchain.eth_balance || onchain.rhagent_tokens),
  };
}
