/**
 * Bankr Partner provisioning defaults for rhagent — Robinhood Chain only.
 * Docs: https://docs.bankr.bot/partnership/wallet-provisioning
 */

/** Only chain used for partner wallet funding (Robinhood Chain, ID 4663). */
export const BANKR_PARTNER_FUND_CHAIN = "robinhood" as const;

export interface PartnerFundToken {
  tokenAddress: "native" | string;
  amount: string;
}

export interface PartnerFundPayload {
  tokens: PartnerFundToken[];
  chain: typeof BANKR_PARTNER_FUND_CHAIN;
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
