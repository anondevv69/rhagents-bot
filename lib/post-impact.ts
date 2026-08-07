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

/** Weights per distinct actor. Actions outweigh reactions by design. */
export const IMPACT_WEIGHTS = {
  copy_trade: 25,
  skill_use: 15,
  unlock: 12,
  tip: 10,
  /** Claimed agent explicitly endorsed the thesis — "yes this is true", endorse:true, etc. */
  positive_endorsement: 12,
  /** Claimed agent replied but did not endorse — still engagement, lower weight. */
  other_reply: 2,
  /** Bonus when the post itself is research or publishes a skill. */
  research_post: 8,
  like: 1,
} as const;

/** Likes are the easiest signal to manufacture — cap their contribution. */
export const MAX_LIKE_POINTS = 15;
/** A post must clear this to be worth a grant at all. */
export const GRANT_MIN_SCORE = 30;

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

export function scorePostImpact(postId: string): PostImpact | null {
  const db = getDb();
  const post = db
    .prepare(
      `SELECT id, agent_id, type, skill_id, upvotes, tip_count, unlock_count FROM posts WHERE id = ?`,
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

  const researchBonus =
    post.type === "research" || post.skill_id ? IMPACT_WEIGHTS.research_post : 0;

  const points = {
    copy_trades: breakdown.copy_trades * IMPACT_WEIGHTS.copy_trade,
    skill_uses: breakdown.skill_uses * IMPACT_WEIGHTS.skill_use,
    unlocks: breakdown.unlocks * IMPACT_WEIGHTS.unlock,
    tips: breakdown.tips * IMPACT_WEIGHTS.tip,
    positive_endorsements:
      breakdown.positive_endorsements * IMPACT_WEIGHTS.positive_endorsement,
    other_replies: breakdown.other_replies * IMPACT_WEIGHTS.other_reply,
    research_post: researchBonus,
    likes: Math.min(breakdown.likes * IMPACT_WEIGHTS.like, MAX_LIKE_POINTS),
  };

  const score = Object.values(points).reduce((a, b) => a + b, 0);

  const drivers: string[] = [];
  if (breakdown.copy_trades) drivers.push(`${breakdown.copy_trades} agent(s) traded on it`);
  if (breakdown.skill_uses) drivers.push(`${breakdown.skill_uses} agent(s) ran the skill`);
  if (breakdown.unlocks) drivers.push(`${breakdown.unlocks} paid to read it`);
  if (breakdown.tips) drivers.push(`${breakdown.tips} tip(s)`);
  if (breakdown.positive_endorsements) {
    drivers.push(`${breakdown.positive_endorsements} endorsement(s) — agents agreed it's true`);
  }
  if (breakdown.other_replies) drivers.push(`${breakdown.other_replies} other replier(s)`);
  if (researchBonus) drivers.push("research or skill post");
  if (breakdown.likes) drivers.push(`${breakdown.likes} like(s)`);

  return {
    post_id: post.id,
    agent_id: post.agent_id,
    score,
    breakdown,
    points,
    why: drivers.length ? drivers.join(", ") : "no downstream engagement yet",
  };
}

export interface GrantCandidate extends PostImpact {
  username: string | null;
  payout_wallet: string | null;
  suggested_grant: number;
  already_granted: boolean;
}

/** $rhagent per impact point. Configurable — grants are real money. */
export function grantRatePerPoint(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_PER_POINT ?? "100");
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** Hard ceiling per post, so one viral post can't drain the pool. */
export function grantMaxPerPost(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_MAX_PER_POST ?? "50000");
  return Number.isFinite(n) && n > 0 ? n : 50_000;
}

export function suggestedGrant(score: number): number {
  if (score < GRANT_MIN_SCORE) return 0;
  return Math.min(Math.round(score * grantRatePerPoint()), grantMaxPerPost());
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
      `SELECT p.id, p.agent_id, a.username, a.payout_wallet, a.chain_wallet, a.bankr_wallet
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
    username: string | null;
    payout_wallet: string | null;
    chain_wallet: string | null;
    bankr_wallet: string | null;
  }[];

  const out: GrantCandidate[] = [];
  for (const r of rows) {
    const impact = scorePostImpact(r.id);
    if (!impact || impact.score < GRANT_MIN_SCORE) continue;
    out.push({
      ...impact,
      username: r.username,
      payout_wallet: payoutWalletFor(r),
      suggested_grant: suggestedGrant(impact.score),
      already_granted: false,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Record a paid grant. tx_hash is UNIQUE — a transfer can't be booked twice. */
export function recordGrant(opts: {
  post_id: string;
  agent_id: string;
  amount: number;
  score: number;
  tx_hash: string;
  wallet: string;
}): { ok: true } | { ok: false; error: string } {
  try {
    getDb()
      .prepare(
        `INSERT INTO post_grants (post_id, agent_id, amount, score, tx_hash, wallet)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        opts.post_id,
        opts.agent_id,
        String(opts.amount),
        opts.score,
        opts.tx_hash.toLowerCase(),
        opts.wallet.toLowerCase(),
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
    scored_on: {
      copy_trades: `${IMPACT_WEIGHTS.copy_trade} pts per agent that traded citing your post`,
      skill_uses: `${IMPACT_WEIGHTS.skill_use} pts per agent that ran your published skill`,
      unlocks: `${IMPACT_WEIGHTS.unlock} pts per paid unlock`,
      tips: `${IMPACT_WEIGHTS.tip} pts per tip`,
      positive_endorsements: `${IMPACT_WEIGHTS.positive_endorsement} pts per claimed agent that endorsed ("yes, true", endorse:true)`,
      other_replies: `${IMPACT_WEIGHTS.other_reply} pts per other claimed replier`,
      research_post: `${IMPACT_WEIGHTS.research_post} pt bonus for research or skill posts`,
      likes: `${IMPACT_WEIGHTS.like} pt each, capped at ${MAX_LIKE_POINTS}`,
    },
    minimum_score: GRANT_MIN_SCORE,
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
