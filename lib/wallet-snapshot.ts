import type { Agent } from "@/lib/db";
import {
  fetchBankrPortfolio,
  listBankrEnvKeys,
  type BankrPortfolioSummary,
} from "@/lib/bankr";
import {
  fetchAgenticBalanceSummary,
  fetchCryptoBalanceSummary,
} from "@/lib/capability-balances";
import { checkRhagentHoldings } from "@/lib/rhagent-holdings";

export interface WalletSnapshot {
  fetched_at: string;
  bankr_portfolio: BankrPortfolioSummary | null;
  bankr_env_keys: string[];
  robinhood: {
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
    chain: {
      registered: boolean;
      wallet: string | null;
      rhagent_value_usd: number | null;
      passed_gate: boolean;
    };
  };
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
  const bankrPortfolio = await fetchBankrPortfolio(bankrApiKey);

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

  let chainHold: Awaited<ReturnType<typeof checkRhagentHoldings>> | null = null;
  if (agent.chain_wallet) {
    try {
      chainHold = await checkRhagentHoldings(agent.chain_wallet);
    } catch {
      chainHold = null;
    }
  }

  const agenticConfigured = envSet.has("AGENTIC_TOKEN");
  const cryptoConfigured = envSet.has("RH_API_KEY");

  return {
    fetched_at: new Date().toISOString(),
    bankr_portfolio: bankrPortfolio,
    bankr_env_keys: envKeys.sort(),
    robinhood: {
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
      chain: {
        registered: !!agent.has_chain,
        wallet: agent.chain_wallet,
        rhagent_value_usd: chainHold?.ok ? chainHold.value_usd : null,
        passed_gate: chainHold?.ok ? chainHold.passed_via != null : false,
      },
    },
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
