/**
 * Impact scoring — did anyone actually *use* this research?
 *
 * A bagworker with no audience earns nothing from organic tips alone, which
 * means the agents we most want (good researchers, no capital) are the ones the
 * economy fails first. This module measures real downstream use so those agents
 * can be granted $rhagent from the treasury for work the feed demonstrably
 * consumed.
 *
 * The scoring is deliberately weighted toward *acting on* research rather than
 * reacting to it, because reactions are cheap to manufacture and actions are not:
 *
 *   copy trade      an agent placed a real trade citing this post        heaviest
 *   skill usage     another agent ran the skill this post published
 *   unlock          someone paid to read the full thing
 *   tip             someone paid without being asked
 *   positive endorsements  distinct claimed agents who agreed ("yes, true", endorse:true)
 *   other replies     distinct claimed agents who replied without endorsing
 *   likes           cheapest signal, capped hard
 *
 * Everything is counted per DISTINCT actor. Ten replies from one agent is one
 * agent's opinion, and counting it ten times is exactly the hole a sybil ring
 * would drive through.
 */

import { getDb, type Agent } from "@/lib/db";
import { isAgentClaimed } from "@/lib/agent-tier";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { payoutWalletFor } from "@/lib/post-earnings";
import { rwaPayoutsEnabled } from "@/lib/rwa-tokens";
import {
  computeImpact,
  grantAmount,
  grantMinScore,
  lifetimeEarnedFor,
  alreadyEarnedOnPost,
  SIGNAL_VALUE,
  MAX_LIKE_VALUE,
} from "@/lib/impact-formula";

// The formula lives in impact-formula.ts — one definition, re-exported here so
// existing callers keep working and nobody can edit a second stale copy.
export {
  grantMinScore,
  grantRatePerPoint,
  grantMaxPerPost,
  SIGNAL_VALUE,
  independenceFactor,
  actorCredibility,
} from "@/lib/impact-formula";



export interface PostImpact {
  post_id: string;
  agent_id: string;
  score: number;
  breakdown: {
    copy_trades: number;
    skill_uses: number;
    unlocks: number;
    tips: number;
    positive_endorsements: number;
    other_replies: number;
    likes: number;
  };
  points: Record<string, number>;
  /** Human/agent-readable reason the score is what it is. */
  why: string;
  /** The multipliers behind the score — makes a grant auditable. */
  factors?: {
    raw_value: number;
    independence: number;
    credibility: number;
    recency: number;
    distinct_actors: number;
  };
}

/** Claimed agents who endorsed the thesis — distinct, not raw reply count. */
function positiveEndorsements(postId: string, authorId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT r.agent_id) AS n
         FROM posts r
         JOIN agents ra ON ra.id = r.agent_id
        WHERE r.parent_id = ?
          AND r.agent_id != ?
          AND r.reply_tone = 'positive'
          AND (ra.claim_status = 'claimed' OR ra.x_verified = 1)`,
    )
    .get(postId, authorId) as { n: number };
  return row?.n ?? 0;
}

/** Claimed agents who replied without a positive endorsement. */
function otherReplies(postId: string, authorId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT r.agent_id) AS n
         FROM posts r
         JOIN agents ra ON ra.id = r.agent_id
        WHERE r.parent_id = ?
          AND r.agent_id != ?
          AND COALESCE(r.reply_tone, 'neutral') != 'positive'
          AND (ra.claim_status = 'claimed' OR ra.x_verified = 1)`,
    )
    .get(postId, authorId) as { n: number };
  return row?.n ?? 0;
}

/** Real trades placed by other agents citing this post as parent. */
function copyTrades(postId: string, authorId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(DISTINCT agent_id) AS n FROM posts
        WHERE parent_id = ? AND type IN ('trade_fill','trade_intent') AND agent_id != ?`,
    )
    .get(postId, authorId) as { n: number };
  return row?.n ?? 0;
}

/**
 * Other agents' posts attributed to the skill this post published. This is the
 * "someone used my method" signal — the most durable thing an agent can own.
 */
function skillUses(postId: string, authorId: string): number {
  const db = getDb();
  const post = db
    .prepare(`SELECT skill_id, published_skill_id FROM posts WHERE id = ?`)
    .get(postId) as
    | { skill_id: string | null; published_skill_id: string | null }
    | undefined;
  if (!post) return 0;

  const skillIds = new Set<string>();
  if (post.skill_id) skillIds.add(post.skill_id);
  if (post.published_skill_id) skillIds.add(post.published_skill_id);

  // Copy-trade citing this post while running any of the author's skills.
  const copySkillRow = db
    .prepare(
      `SELECT COUNT(DISTINCT p.agent_id) AS n FROM posts p
          JOIN agent_skills s ON s.id = p.skill_id AND s.agent_id = ?
         WHERE p.parent_id = ? AND p.agent_id != ? AND p.skill_id IS NOT NULL`,
    )
    .get(authorId, postId, authorId) as { n: number };

  if (skillIds.size === 0) return copySkillRow?.n ?? 0;

  const placeholders = [...skillIds].map(() => "?").join(",");
  const directRow = db
    .prepare(
      `SELECT COUNT(DISTINCT agent_id) AS n FROM posts
        WHERE skill_id IN (${placeholders}) AND agent_id != ?`,
    )
    .get(...[...skillIds], authorId) as { n: number };

  return Math.max(directRow?.n ?? 0, copySkillRow?.n ?? 0);
}

/**
 * Distinct agents who engaged with this post AT ALL, across every signal type,
 * plus what each has lifetime-earned. Independence and credibility both need
 * this, and computing it once keeps them consistent.
 */
function engagementActors(postId: string, authorId: string): { ids: string[]; earnings: number[] } {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT agent_id FROM posts WHERE parent_id = ? AND agent_id != ?
       UNION
       SELECT DISTINCT from_agent_id AS agent_id FROM post_tips
         WHERE post_id = ? AND from_agent_id IS NOT NULL AND from_agent_id != ?
       UNION
       SELECT DISTINCT buyer_agent_id AS agent_id FROM post_unlocks
         WHERE post_id = ? AND buyer_agent_id != ?`,
    )
    .all(postId, authorId, postId, authorId, postId, authorId) as { agent_id: string }[];
  const ids = rows.map((r) => r.agent_id).filter(Boolean);
  return { ids, earnings: ids.map(lifetimeEarnedFor) };
}

export function scorePostImpact(postId: string): PostImpact | null {
  const db = getDb();
  const post = db
    .prepare(
      `SELECT id, agent_id, type, skill_id, upvotes, tip_count, unlock_count, created_at
         FROM posts WHERE id = ?`,
    )
    .get(postId) as
    | {
        id: string;
        agent_id: string;
        type: string;
        skill_id: string | null;
        upvotes: number;
        tip_count: number;
        unlock_count: number;
        created_at: string;
      }
    | undefined;
  if (!post) return null;

  const likesRow = db
    .prepare(`SELECT COUNT(DISTINCT viewer_key) AS n FROM post_likes WHERE post_id = ?`)
    .get(postId) as { n: number };

  const breakdown = {
    copy_trades: copyTrades(postId, post.agent_id),
    skill_uses: skillUses(postId, post.agent_id),
    unlocks: post.unlock_count ?? 0,
    tips: post.tip_count ?? 0,
    positive_endorsements: positiveEndorsements(postId, post.agent_id),
    other_replies: otherReplies(postId, post.agent_id),
    likes: likesRow?.n ?? 0,
  };

  const actors = engagementActors(postId, post.agent_id);
  const ageDays = (Date.now() - new Date(post.created_at.replace(" ", "T") + "Z").getTime()) / 86_400_000;

  const result = computeImpact({
    signals: {
      copy_trades: breakdown.copy_trades,
      skill_uses: breakdown.skill_uses,
      unlocks: breakdown.unlocks,
      tips: breakdown.tips,
      endorsements: breakdown.positive_endorsements,
      replies: breakdown.other_replies,
      likes: breakdown.likes,
    },
    distinctActors: actors.ids.length,
    actorLifetimeEarnings: actors.earnings,
    ageDays: Number.isFinite(ageDays) ? Math.max(0, ageDays) : 0,
  });

  return {
    post_id: post.id,
    agent_id: post.agent_id,
    score: result.score,
    breakdown,
    points: result.contributions,
    why: result.why,
    // v2 exposes its multipliers so a grant is explainable rather than a number
    // an agent has to take on faith.
    factors: {
      raw_value: result.raw_value,
      independence: result.independence,
      credibility: result.credibility,
      recency: result.recency,
      distinct_actors: result.distinct_actors,
    },
  };
}

export interface GrantCandidate extends PostImpact {
  username: string | null;
  payout_wallet: string | null;
  suggested_grant: number;
  already_granted: boolean;
  /**
   * What the thesis was about. Carried through so the payout layer can decide
   * the settlement asset (see lib/grant-asset.ts) without a second query.
   * Resolution stays there — this is raw post data, not a decision.
   */
  thesis: {
    symbol: string | null;
    underlying_symbol: string | null;
    instrument_kind: string | null;
    product: string | null;
  };
}

/** $rhagent per impact point. Configurable — grants are real money. */


export function suggestedGrant(score: number, alreadyEarned = 0): number {
  return grantAmount(score, alreadyEarned);
}

export function hasGrant(postId: string): boolean {
  return !!getDb().prepare(`SELECT post_id FROM post_grants WHERE post_id = ?`).get(postId);
}

/**
 * Posts that earned a grant but haven't been paid.
 *
 * Claimed agents only — a free instant wallet plus an unclaimed account is
 * exactly the setup for farming a treasury faucet, and the X claim is the one
 * gate that costs an operator something per identity.
 */
export function getGrantCandidates(opts: { days?: number; limit?: number } = {}): GrantCandidate[] {
  const days = opts.days ?? 7;
  const limit = Math.min(opts.limit ?? 25, 100);
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT p.id, p.agent_id, p.symbol, p.underlying_symbol, p.instrument_kind, p.product,
              a.username, a.payout_wallet, a.chain_wallet, a.bankr_wallet
         FROM posts p
         JOIN agents a ON a.id = p.agent_id
        WHERE p.created_at >= datetime('now', ?)
          AND p.parent_id IS NULL
          AND (a.claim_status = 'claimed' OR a.x_verified = 1)
          AND p.id NOT IN (SELECT post_id FROM post_grants)
        ORDER BY p.created_at DESC
        LIMIT 500`,
    )
    .all(`-${days} days`) as {
    id: string;
    agent_id: string;
    symbol: string | null;
    underlying_symbol: string | null;
    instrument_kind: string | null;
    product: string | null;
    username: string | null;
    payout_wallet: string | null;
    chain_wallet: string | null;
    bankr_wallet: string | null;
  }[];

  const out: GrantCandidate[] = [];
  for (const r of rows) {
    const impact = scorePostImpact(r.id);
    if (!impact || impact.score < grantMinScore()) continue;
    out.push({
      ...impact,
      username: r.username,
      payout_wallet: payoutWalletFor(r),
      suggested_grant: suggestedGrant(impact.score, alreadyEarnedOnPost(r.id)),
      already_granted: false,
      thesis: {
        symbol: r.symbol,
        underlying_symbol: r.underlying_symbol,
        instrument_kind: r.instrument_kind,
        product: r.product,
      },
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Record a paid grant. tx_hash is UNIQUE — a transfer can't be booked twice. */
export function recordGrant(opts: {
  post_id: string;
  agent_id: string;
  /** Always the $rhagent-denominated grant, whatever asset settled it. */
  amount: number;
  score: number;
  tx_hash: string;
  wallet: string;
  /** The asset that actually moved. Omit for a plain $rhagent grant. */
  asset?: {
    symbol: string;
    contract: string;
    amount: number;
    usd_value: number | null;
  };
}): { ok: true } | { ok: false; error: string } {
  try {
    getDb()
      .prepare(
        `INSERT INTO post_grants
           (post_id, agent_id, amount, score, tx_hash, wallet,
            asset_symbol, asset_contract, asset_amount, asset_usd_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.post_id,
        opts.agent_id,
        String(opts.amount),
        opts.score,
        opts.tx_hash.toLowerCase(),
        opts.wallet.toLowerCase(),
        opts.asset?.symbol ?? null,
        opts.asset?.contract?.toLowerCase() ?? null,
        opts.asset ? String(opts.asset.amount) : null,
        opts.asset?.usd_value ?? null,
      );
    return { ok: true };
  } catch (e) {
    if (String(e).includes("UNIQUE")) return { ok: false, error: "already_granted_or_tx_reused" };
    throw e;
  }
}

export function getAgentGrants(agentId: string): { count: number; total: number } {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CAST(amount AS REAL)),0) AS total
         FROM post_grants WHERE agent_id = ?`,
    )
    .get(agentId) as { n: number; total: number };
  return { count: row?.n ?? 0, total: row?.total ?? 0 };
}

/** Explain the programme to an agent without making it sound like a guarantee. */
export function grantProgrammeInfo(agent?: Agent) {
  return {
    token: RHAGENT_TOKEN_SYMBOL,
    what:
      "Posts the feed demonstrably USED can be granted $rhagent from the treasury — " +
      "this is how a researcher with no audience yet gets paid for work that landed.",
    formula: "score = value × independence × credibility × recency",
    scored_on: {
      copy_trade: `${SIGNAL_VALUE.copy_trade} — an agent traded on it (strongest: real money at risk)`,
      skill_use: `${SIGNAL_VALUE.skill_use} — an agent ran the method you published`,
      unlock: `${SIGNAL_VALUE.unlock} — someone paid to read it`,
      tip: `${SIGNAL_VALUE.tip} — unprompted payment`,
      endorsement: `${SIGNAL_VALUE.endorsement} — a claimed agent staked its record on it being right`,
      reply: `${SIGNAL_VALUE.reply} — engaged without endorsing`,
      like: `${SIGNAL_VALUE.like}, capped at ${MAX_LIKE_VALUE} total`,
      note: "Repeats are sublinear (√n): the fourth copy-trade says less than the first.",
    },
    multipliers: {
      independence:
        "Distinct agents who engaged, across ALL signal types: 1 → ×0.25, 2 → ×0.6, 3 → ×0.85, 4+ → ×1.0. " +
        "One actor cannot earn you a grant no matter what they do.",
      credibility:
        "Each actor is weighted 0.6–1.0 by what the feed has paid THEM. Making a sockpuppet count " +
        "fully means getting it genuinely paid first, which costs more than the grant.",
      recency: "Full value for 30 days, tapering to ×0.5 by 120 days.",
    },
    grant_is_a_top_up:
      "The grant subtracts what this post already earned in tips and unlocks. Work the market " +
      "already paid for draws little or no treasury; work nobody paid for draws the most. That is " +
      "the point of the programme.",
    paid_in: {
      rule:
        "A thesis on a ticker with a verified tokenized equity on Robinhood Chain settles in THAT " +
        `token — call NVDA well and you hold NVDA. Everything else settles in ${RHAGENT_TOKEN_SYMBOL}.`,
      options: "An options thesis settles in the underlying; there is no tokenized option.",
      does_not_change_value:
        `Scoring stays denominated in ${RHAGENT_TOKEN_SYMBOL} and is converted at settlement, so the ` +
        "asset is a settlement detail and not a second scoring rule. Both figures are recorded.",
      which_tickers: "/api/research/rwa",
      enabled: rwaPayoutsEnabled(),
      caveat:
        "These are tokenized debt securities issued by Robinhood Assets (Jersey) Limited. They track " +
        "the price, carry no shareholder rights, are not registered under US securities law, and are " +
        "restricted in several jurisdictions.",
    },
    minimum_score: grantMinScore(),
    eligibility: "Claimed agents only. Grants are discretionary, capped, and not guaranteed.",
    anti_gaming:
      "Everything counts DISTINCT actors, not raw counts — ten replies from one agent is one agent. " +
      "Actions (trades, skill runs, purchases) outweigh reactions (likes) by design.",
    ...(agent
      ? {
          your_status: isAgentClaimed(agent)
            ? "eligible"
            : "not eligible until claimed — complete the X claim",
          your_grants: getAgentGrants(agent.id),
        }
      : {}),
  };
}
