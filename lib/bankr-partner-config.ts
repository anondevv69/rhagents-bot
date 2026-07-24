/**
 * Bankr Partner provisioning defaults for rhagent — Robinhood Chain only.
 * Docs: https://docs.bankr.bot/partnership/wallet-provisioning
 */

/** Primary chain used for partner wallet funding (Robinhood Chain, ID 4663). */
export const BANKR_PARTNER_FUND_CHAIN = "robinhood" as const;

/** Chains the POST /partner/wallets/:id/fund endpoint accepts. */
export type PartnerFundChain = "robinhood" | "base" | "polygon" | "mainnet" | "unichain";

export interface PartnerFundToken {
  tokenAddress: "native" | string;
  amount: string;
}

export interface PartnerFundPayload {
  tokens: PartnerFundToken[];
  chain: PartnerFundChain;
}

/** Default API key permissions for provisioned rhagent wallets. */
export function defaultWalletApiKeyBody(channel?: string) {
  return {
    name: channel ? `rhagent-${channel}`.slice(0, 64) : "rhagent",
    permissions: {
      agentApiEnabled: true,
      llmGatewayEnabled: true,
      tokenLaunchApiEnabled: false,
      readOnly: false,
    },
  };
}

/**
 * Optional native ETH fund on Robinhood Chain during or after provision.
 * Set BANKR_PROVISION_FUND_ETH (e.g. 0.001). Chain is always robinhood — not Base.
 */
export function buildPartnerFundPayload(): PartnerFundPayload | null {
  const amount = process.env.BANKR_PROVISION_FUND_ETH?.trim();
  if (!amount) return null;

  const envChain = process.env.BANKR_PROVISION_FUND_CHAIN?.trim().toLowerCase();
  if (envChain && envChain !== BANKR_PARTNER_FUND_CHAIN) {
    console.warn(
      `[bankr-provision] BANKR_PROVISION_FUND_CHAIN=${envChain} ignored — rhagent only funds on ${BANKR_PARTNER_FUND_CHAIN}`,
    );
  }

  return {
    tokens: [{ tokenAddress: "native", amount }],
    chain: BANKR_PARTNER_FUND_CHAIN,
  };
}

/**
 * Starter LLM credit grant — separate from the Robinhood Chain ETH fund above.
 *
 * LLM Gateway credits (Max Mode) are a distinct balance from on-chain assets, topped up in
 * USDC/USDT/ETH/any ERC-20 on Base, Polygon, Ethereum, Arbitrum, or BNB Chain — see
 * https://docs.bankr.bot/llm-gateway/overview#credit-management. Bankr's documented partner
 * surface does not expose a server-side "convert wallet balance to LLM credit" endpoint —
 * only the CLI (`bankr llm credits add`) and the bankr.bot dashboard, both of which act on
 * behalf of the wallet's own funds. So this only funds Base USDC into the wallet; the actual
 * credit conversion still needs the user (or a future confirmed partner endpoint) to trigger
 * `bankr llm credits add` once. Treat BANKR_PROVISION_STARTER_CREDIT_USD as "how much Base USDC
 * to seed" — verify against current partner docs before assuming this auto-becomes credit.
 */
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function buildStarterCreditFundPayload(): PartnerFundPayload | null {
  const amount = process.env.BANKR_PROVISION_STARTER_CREDIT_USD?.trim();
  if (!amount) return null;

  return {
    tokens: [{ tokenAddress: BASE_USDC_ADDRESS, amount }],
    // Starter credit is funded on Base (LLM Gateway top-up chain), not Robinhood Chain.
    chain: "base",
  };
}
