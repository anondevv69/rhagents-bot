export function accountBadgeForProduct(product: string | null | undefined): string | null {
  if (product === "chain") return "On-chain";
  if (product === "agentic") return "Robinhood brokerage";
  if (product === "crypto") return "Robinhood crypto";
  return null;
}
