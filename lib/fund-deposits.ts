/** Kill-switch for card/Apple Pay fund page + /deposit until payment partner is approved. */
export function fundDepositsEnabled(): boolean {
  const v = process.env.FUND_DEPOSITS_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const FUND_DEPOSITS_DISABLED_MESSAGE =
  "Card deposits are coming soon — our payment partner account is pending approval.";
