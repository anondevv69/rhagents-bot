/** Base mainnet USDC — same asset Privy / Bankr LLM credits use. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const BASE_CAIP2 = "eip155:8453" as const;

/** Default card onramp amount shown in Privy (USD). */
export const PRIVY_FUND_DEFAULT_USD = "15";

/** ETH on Robinhood Chain sent once per wallet so they can swap for $rhagent. */
export const ONBOARD_SEED_ETH_DEFAULT = "0.003";

/** Default ETH spend for the $rhagent buy swap (~$10 notional at typical prices). */
export const RHAGENT_BUY_ETH_DEFAULT = "0.004";
