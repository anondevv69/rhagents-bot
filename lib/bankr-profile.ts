import type { Agent } from "@/lib/db";
import { parseStoredWalletSnapshot } from "@/lib/wallet-snapshot";

export interface BankrProfileView {
  managed: boolean;
  wallet: string | null;
  walletShort: string | null;
  snapshotAt: string | null;
  chainTotalUsd: number | null;
  ethBalance: string | null;
  rhagentTokens: number | null;
  rhagentValueUsd: number | null;
  topTokens: { symbol: string; usd: number; balance?: string }[];
  envKeys: string[];
  capabilities: {
    agentic: boolean;
    crypto: boolean;
    chain: boolean;
    agenticInBankr: boolean;
    cryptoInBankr: boolean;
  };
  nftMinted: boolean;
  nftExplorer: string | null;
}

export function bankrProfileViewFromAgent(agent: Agent): BankrProfileView {
  const snapshot = parseStoredWalletSnapshot(agent.bankr_wallet_snapshot);
  const rc = snapshot?.robinhood_chain;
  const envKeys = snapshot?.bankr_env_keys ?? [];
  const envSet = new Set(envKeys.map((k) => k.toUpperCase()));
  const wallet = agent.bankr_wallet?.trim() || rc?.wallet || null;

  return {
    managed: Boolean(wallet),
    wallet,
    walletShort: wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null,
    snapshotAt: agent.bankr_wallet_snapshot_at ?? snapshot?.fetched_at ?? null,
    chainTotalUsd: rc?.total_usd ?? null,
    ethBalance: rc?.eth_balance ?? null,
    rhagentTokens: rc?.rhagent_tokens ?? null,
    rhagentValueUsd: rc?.rhagent_value_usd ?? null,
    topTokens: rc?.tokens?.slice(0, 6) ?? [],
    envKeys,
    capabilities: {
      agentic: !!agent.has_agentic,
      crypto: !!agent.has_crypto,
      chain: !!agent.has_chain,
      agenticInBankr: envSet.has("AGENTIC_TOKEN"),
      cryptoInBankr: envSet.has("RH_API_KEY"),
    },
    nftMinted: Boolean(agent.nft_tx_hash),
    nftExplorer:
      agent.nft_explorer_url && agent.nft_explorer_url.startsWith("http")
        ? agent.nft_explorer_url
        : null,
  };
}
