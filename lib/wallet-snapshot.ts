import type { Agent } from "@/lib/db";
import { listBankrEnvKeys } from "@/lib/bankr";
import {
  buildRobinhoodChainWalletView,
  type RobinhoodChainWalletView,
} from "@/lib/robinhood-chain-balance";
import {
  fetchAgenticBalanceSummary,
  fetchCryptoBalanceSummary,
} from "@/lib/capability-balances";

export interface WalletSnapshot {
  fetched_at: string;
  /** Primary view — Robinhood Chain wallet tied to Bankr. */
  robinhood_chain: RobinhoodChainWalletView | null;
  bankr_env_keys: string[];
  /** Optional Robinhood App products — only when owner pasted extra creds. */
  robinhood_app?: {
    agentic: {
      registered: boolean;
      configured_in_bankr: boolean;
      portfolio_usd: number | null;
      buying_power_usd: number | null;
      summary: string | null;
      error: string | null;
    };
    crypto: {
      registered: boolean;
      configured_in_bankr: boolean;
      buying_power_usd: number | null;
      summary: string | null;
      error: string | null;
    };
  };
}

/** @deprecated Legacy snapshot field — use robinhood_chain. */
export interface WalletSnapshotLegacy extends WalletSnapshot {
  bankr_portfolio?: unknown;
  robinhood?: WalletSnapshot["robinhood_app"];
}

export interface WalletSnapshotInput {
  bankrApiKey: string;
  agent: Agent;
  /** Optional — never stored; enables live Agentic stocks/RWA balance line. */
  agenticToken?: string | null;
  /** Optional — never stored; enables live Robinhood Crypto balance. */
  rhApiKey?: string | null;
  rhPrivateKeyB64?: string | null;
}

export async function buildWalletSnapshot(input: WalletSnapshotInput): Promise<WalletSnapshot> {
  const { bankrApiKey, agent } = input;
  const envKeys = await listBankrEnvKeys(bankrApiKey);
  const envSet = new Set(envKeys.map((k) => k.toUpperCase()));

  const walletForChain = agent.bankr_wallet ?? null;
  const robinhood_chain = walletForChain
    ? await buildRobinhoodChainWalletView(walletForChain, bankrApiKey)
    : null;

  let agenticLive: Awaited<ReturnType<typeof fetchAgenticBalanceSummary>> | null = null;
  const agenticToken = input.agenticToken?.trim();
  if (agenticToken) {
    agenticLive = await fetchAgenticBalanceSummary(agenticToken);
  }

  let cryptoLive: Awaited<ReturnType<typeof fetchCryptoBalanceSummary>> | null = null;
  const rhKey = input.rhApiKey?.trim();
  const rhPk = input.rhPrivateKeyB64?.trim();
  if (rhKey && rhPk) {
    cryptoLive = await fetchCryptoBalanceSummary(rhKey, rhPk);
  }

  const agenticConfigured = envSet.has("AGENTIC_TOKEN");
  const cryptoConfigured = envSet.has("RH_API_KEY");
  const showAppSection = Boolean(agenticToken || (rhKey && rhPk));

  return {
    fetched_at: new Date().toISOString(),
    robinhood_chain,
    bankr_env_keys: envKeys.sort(),
    ...(showAppSection
      ? {
          robinhood_app: {
            agentic: {
              registered: !!agent.has_agentic,
              configured_in_bankr: agenticConfigured,
              portfolio_usd: agenticLive?.portfolio_usd ?? null,
              buying_power_usd: agenticLive?.buying_power_usd ?? null,
              summary: agenticLive?.summary ?? null,
              error: agenticLive?.error ?? null,
            },
            crypto: {
              registered: !!agent.has_crypto,
              configured_in_bankr: cryptoConfigured,
              buying_power_usd: cryptoLive?.buying_power_usd ?? null,
              summary: cryptoLive?.summary ?? null,
              error: cryptoLive?.error ?? null,
            },
          },
        }
      : {}),
  };
}

export function parseStoredWalletSnapshot(raw: string | null | undefined): WalletSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as WalletSnapshot;
  } catch {
    return null;
  }
}
