/**
 * USD-denominated payouts — convert to $rhagent at execution time using live price.
 *
 * Default mode is USD so tips and grants stay meaningful as the token price moves.
 * Set RHAGENT_PAYOUT_DENOM=token to use legacy fixed token amounts.
 */

import { fetchTokenPriceUsd } from "@/lib/rhagent-holdings";
import { RHAGENT_TOKEN_CONTRACT } from "@/lib/rhagent-token";

export type PayoutDenomMode = "usd" | "token";

export function payoutDenomMode(): PayoutDenomMode {
  const mode = (process.env.RHAGENT_PAYOUT_DENOM || "usd").trim().toLowerCase();
  return mode === "token" ? "token" : "usd";
}

/** Target USD per impact point before top-up subtraction. Score 40 → $10 at default. */
export function grantUsdPerPoint(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_USD_PER_POINT ?? "0.25");
  return Number.isFinite(n) && n > 0 ? n : 0.25;
}

export function grantMaxUsdPerPost(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_MAX_USD ?? "25");
  return Number.isFinite(n) && n > 0 ? n : 25;
}

const AUTO_TIP_USD_DEFAULTS = {
  copy_trade: 1.0,
  skill_use: 0.5,
  unlock: 0.3,
  endorse_with_action: 0.15,
  endorse_only: 0,
} as const;

export type AutoTipUsdTrigger = keyof typeof AUTO_TIP_USD_DEFAULTS;

export function autoTipUsdFor(trigger: AutoTipUsdTrigger): number {
  const envKey =
    trigger === "endorse_with_action"
      ? "RHAGENT_AUTO_TIP_USD_ENDORSE_ACTION"
      : trigger === "endorse_only"
        ? "RHAGENT_AUTO_TIP_USD_ENDORSE_ONLY"
        : `RHAGENT_AUTO_TIP_USD_${trigger.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw == null || raw === "") return AUTO_TIP_USD_DEFAULTS[trigger];
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : AUTO_TIP_USD_DEFAULTS[trigger];
}

/** Convert a USD target to whole-token units at the given price. Returns null if price unknown. */
export function rhagentTokensForUsd(usd: number, priceUsd: number | null | undefined): number | null {
  if (!(usd > 0)) return 0;
  if (priceUsd == null || !(priceUsd > 0)) return null;
  const tokens = usd / priceUsd;
  if (!Number.isFinite(tokens) || tokens <= 0) return null;
  return Math.max(1, Math.round(tokens));
}

let priceCache: { at: number; usd: number | null } | null = null;
const PRICE_TTL_MS = 60_000;

/** Cached live $rhagent USD price for grant batches and auto-tips. */
export async function fetchRhagentUsdPrice(): Promise<number | null> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) {
    return priceCache.usd;
  }
  const usd = await fetchTokenPriceUsd(RHAGENT_TOKEN_CONTRACT);
  priceCache = { at: Date.now(), usd };
  return usd;
}

export function payoutDenomSummary(priceUsd: number | null) {
  if (payoutDenomMode() === "token") {
    return { mode: "token" as const, rhagent_price_usd: priceUsd };
  }
  return {
    mode: "usd" as const,
    rhagent_price_usd: priceUsd,
    grant_usd_per_point: grantUsdPerPoint(),
    grant_max_usd_per_post: grantMaxUsdPerPost(),
    auto_tip_usd: AUTO_TIP_USD_DEFAULTS,
  };
}
