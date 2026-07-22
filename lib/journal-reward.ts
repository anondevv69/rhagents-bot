import type { Agent, Post } from "@/lib/db";
import { getDb } from "@/lib/db";
import { isLeaderboardNormie } from "@/lib/agents-leaderboard";

/** Minimum USD notional for trade_fill reward eligibility (off-chain gate). */
export const REWARD_MIN_TRADE_USD = 10;

/** Max qualifying trade posts per agent in rolling 1h window (reward eligibility only). */
export const REWARD_MAX_TRADES_PER_HOUR = 5;

export type JournalAccountKind = "agent" | "normie";

export type JournalRewardMeta = {
  accountKind: JournalAccountKind;
  payoutWallet: `0x${string}` | null;
  rewardEligible: boolean;
  skipReason?: string;
};

function isAddress(v: string | null | undefined): v is `0x${string}` {
  return Boolean(v && /^0x[a-fA-F0-9]{40}$/.test(v));
}

function tradeNotionalUsd(post: Post): number | null {
  const qty = post.quantity?.trim();
  const px = post.price_usd?.trim();
  if (!qty || !px) return null;
  const q = Number(qty);
  const p = Number(px);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null;
  return q * p;
}

function recentTradePostCount(agentId: string, withinMs: number): number {
  const db = getDb();
  const since = new Date(Date.now() - withinMs).toISOString();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM posts
       WHERE agent_id = ?
         AND type IN ('trade_fill', 'trade_intent')
         AND created_at >= ?`,
    )
    .get(agentId, since) as { n: number };
  return row?.n ?? 0;
}

function payoutWalletFor(agent: Agent): `0x${string}` | null {
  if (isAddress(agent.chain_wallet)) {
    return agent.chain_wallet.toLowerCase() as `0x${string}`;
  }
  if (isAddress(agent.bankr_wallet)) {
    return agent.bankr_wallet.toLowerCase() as `0x${string}`;
  }
  return null;
}

/** Decide journal reward fields before calling RhagentPostJournal v1.3. */
export function journalRewardMeta(agent: Agent, post: Post): JournalRewardMeta {
  const normie = isLeaderboardNormie({
    has_chain: agent.has_chain ?? 0,
    has_agentic: agent.has_agentic ?? 0,
    has_crypto: agent.has_crypto ?? 0,
  });

  const accountKind: JournalAccountKind = normie ? "normie" : "agent";

  const wallet = payoutWalletFor(agent);

  if (accountKind === "normie") {
    return { accountKind, payoutWallet: wallet, rewardEligible: false, skipReason: "normie" };
  }

  if (!wallet) {
    return { accountKind, payoutWallet: null, rewardEligible: false, skipReason: "no_wallet" };
  }

  const side = (post.side ?? "").trim().toLowerCase();
  const isTrade = post.type === "trade_fill" || post.type === "trade_intent";
  if (!isTrade || (side !== "buy" && side !== "sell")) {
    return { accountKind, payoutWallet: wallet, rewardEligible: false, skipReason: "not_trade" };
  }

  // Prefer verified fills; intents only if notional is present and above min.
  if (post.type === "trade_intent") {
    return { accountKind, payoutWallet: wallet, rewardEligible: false, skipReason: "trade_intent" };
  }

  const notional = tradeNotionalUsd(post);
  if (notional == null || notional < REWARD_MIN_TRADE_USD) {
    return {
      accountKind,
      payoutWallet: wallet,
      rewardEligible: false,
      skipReason: "min_notional",
    };
  }

  const hourly = recentTradePostCount(agent.id, 60 * 60 * 1000);
  if (hourly > REWARD_MAX_TRADES_PER_HOUR) {
    return { accountKind, payoutWallet: wallet, rewardEligible: false, skipReason: "velocity" };
  }

  return { accountKind, payoutWallet: wallet, rewardEligible: true };
}

/** Solidity AccountKind enum: 0 = Agent, 1 = Normie */
export function journalAccountKindUint(kind: JournalAccountKind): 0 | 1 {
  return kind === "agent" ? 0 : 1;
}
