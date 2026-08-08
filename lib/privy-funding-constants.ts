/** Base mainnet USDC — same asset Privy / Bankr LLM credits use. */
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export const BASE_CAIP2 = "eip155:8453" as const;

/** Fiat currencies offered in the Privy onramp (MoonPay / Stripe route by region). */
export const PRIVY_FIAT_ASSETS = ["usd", "eur", "gbp", "cad"] as const;

export type PrivyFiatAsset = (typeof PRIVY_FIAT_ASSETS)[number];

/** Default card onramp amount shown in Privy. */
export const PRIVY_FUND_DEFAULT_AMOUNT = "15";

/** @deprecated use PRIVY_FUND_DEFAULT_AMOUNT */
export const PRIVY_FUND_DEFAULT_USD = PRIVY_FUND_DEFAULT_AMOUNT;

/** ETH on Robinhood Chain sent once per wallet so they can swap for $RHAGENT. */
export const ONBOARD_SEED_ETH_DEFAULT = "0.003";

/** Default ETH spend for the $RHAGENT buy swap (~$10 notional at typical prices). */
export const RHAGENT_BUY_ETH_DEFAULT = "0.004";

const LOCALE_FIAT: Record<string, PrivyFiatAsset> = {
  US: "usd",
  CA: "cad",
  GB: "gbp",
  FR: "eur",
  DE: "eur",
  ES: "eur",
  IT: "eur",
  NL: "eur",
  BE: "eur",
  AT: "eur",
  IE: "eur",
  PT: "eur",
  FI: "eur",
  GR: "eur",
};

/** Pick default fiat from browser locale — MoonPay uses currency (eur), not country (fr). */
export function defaultPrivyFiatAsset(locale?: string): PrivyFiatAsset {
  const tag = (locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-US")).trim();
  const region = tag.split("-")[1]?.toUpperCase();
  if (region && LOCALE_FIAT[region]) return LOCALE_FIAT[region];
  if (tag.toLowerCase().startsWith("fr")) return "eur";
  return "usd";
}

export function privyFundLabel(amount: string, fiat: PrivyFiatAsset): string {
  const sym = fiat === "eur" ? "€" : fiat === "gbp" ? "£" : fiat === "cad" ? "CA$" : "$";
  return `Add ${sym}${amount} with card →`;
}
