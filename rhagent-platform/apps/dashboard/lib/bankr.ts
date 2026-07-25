/**
 * Server-side Bankr client instance for dashboard API routes.
 */
import { BankrClient } from "@rhagent/shared";

const partnerKey = process.env.BANKR_PARTNER_KEY;

export function getBankrClient(): BankrClient {
  if (!partnerKey) {
    throw new Error("BANKR_PARTNER_KEY not configured");
  }
  return new BankrClient({
    partnerKey,
    starterCreditUsd: Number(process.env.BANKR_STARTER_CREDIT_USD || "5"),
    fundEth: process.env.BANKR_FUND_ETH || undefined,
  });
}
