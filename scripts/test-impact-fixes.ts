#!/usr/bin/env tsx
/** Quick sanity checks for impact/grant fixes. Run: npx tsx scripts/test-impact-fixes.ts */
import {
  payerDiversityFactor,
  grantAmount,
  lifetimeEarnedFor,
} from "../lib/impact-formula";
import { rhagentTokensForUsd } from "../lib/rhagent-payout-denom";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("ok:", msg);
  }
}

assert(payerDiversityFactor([1000]) === 0, "single payer → zero diversity");
assert(payerDiversityFactor([250, 250, 250, 250]) > 0.7, "four equal payers → high diversity");

process.env.RHAGENT_PAYOUT_DENOM = "usd";
const price = 0.00000088;
const grant = grantAmount(40, 0, { priceUsd: price });
const expectedUsd = 40 * 0.05;
const expectedTokens = rhagentTokensForUsd(Math.min(expectedUsd, 3), price)!;
assert(grant === expectedTokens, `USD grant score 40 → ~${expectedTokens} tokens (capped $3)`);

assert(typeof lifetimeEarnedFor === "function", "lifetimeEarnedFor exported");

if (failed) {
  process.exit(1);
}
console.log("\nAll checks passed.");
