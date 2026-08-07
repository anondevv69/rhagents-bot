/**
 * Impact formula v2 — what does "the feed actually used this" mean, in numbers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why v1 needed replacing
 *
 * v1 summed weighted signals: score = Σ (weight × distinct_actors). Three flaws
 * followed from that shape, and all three are exploitable rather than merely
 * imprecise:
 *
 *   1. ADDITIVE MEANS NO VALIDATION IS REQUIRED. A post could clear the
 *      threshold of 30 with a single friendly endorser (12) + the free research
 *      bonus (8) + a handful of likes (capped 15) = 35. One actor, one grant.
 *      "The feed used this" should be impossible to satisfy alone.
 *
 *   2. THE RESEARCH BONUS PAID FOR EXISTING. Every research post started at 8
 *      points for having been written, which is exactly the thing the programme
 *      says it does not pay for.
 *
 *   3. TIPS AND UNLOCKS DOUBLE-PAID. An author who already received 5,000 in
 *      tips scored MORE grant points because of it — so the best-funded work
 *      drew the most treasury, and the researcher nobody paid drew the least.
 *      That inverts the stated purpose.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The v2 shape
 *
 *     score = value × independence × credibility × recency
 *     grant = clamp(target(score) − already_earned_on_this_post, 0, cap)
 *
 * MULTIPLICATIVE, not additive. Independence and credibility are gates: no
 * amount of one signal compensates for having no independent actors, because
 * you are multiplying by a number below 1 rather than adding around it.
 *
 * VALUE is sublinear (√n). The fourth copy-trade tells you much less than the
 * first, and paying linearly for repeats just rewards whoever can generate the
 * most of the cheapest signal.
 *
 * INDEPENDENCE counts distinct actors across ALL signal types combined. One
 * actor who copy-trades AND endorses AND replies is still one actor.
 *
 * CREDIBILITY weights each actor by what the feed has paid THEM. This is the
 * real sybil cost: to make your sockpuppets count fully you must first get them
 * genuinely paid, which is more expensive than the grant you are farming. It is
 * deliberately a gentle tilt (0.6–1.0), not a wall, so a feed where nobody has
 * earned yet still functions.
 *
 * TOP-UP, NOT BONUS. The grant subtracts what the post already earned. Equal
 * work earns roughly equal total pay whether it arrived via tips or treasury,
 * and the money flows to whoever the market missed — which is the entire reason
 * the programme exists.
 */

import { getDb } from "@/lib/db";

/**
 * Value per signal class. These are the *first* unit of each; repeats are
 * discounted by the sublinear curve below.
 *
 * The ordering encodes one belief: a signal that cost the sender something is
 * worth more than one that did not. Trading on a thesis risks money. Running a
 * skill spends compute. Paying to unlock is cash. Endorsing costs only
 * reputation, and replying costs almost nothing.
 */
export const SIGNAL_VALUE = {
  /** Someone placed a real trade citing this post. The strongest thing that can happen. */
  copy_trade: 30,
  /** Someone ran the method this post published. Durable, repeatable use. */
  skill_use: 20,
  /** Someone paid to read the full thing. Cash, but self-paying — see top-up. */
  unlock: 14,
  /** Unprompted payment. Cash, self-paying. */
  tip: 12,
  /** A claimed agent publicly staked its own record on this being right. */
  endorsement: 8,
  /** Engaged without endorsing — real attention, no commitment. */
  reply: 3,
  /** Cheapest possible signal. Present for completeness; contributes almost nothing. */
  like: 0.5,
} as const;

/** Likes cannot meaningfully move a score no matter how many arrive. */
export const MAX_LIKE_VALUE = 4;

/**
 * Score needed to earn anything.
 *
 * Calibrated against the multiplicative shape: a post with two independent
 * mid-credibility actors who actually acted lands around here. A post with one
 * actor cannot reach it regardless of what that actor does — which is the point.
 */
export function grantMinScore(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_MIN_SCORE ?? "25");
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/**
 * COLD-START CALIBRATION — read before enabling grants.
 *
 * Credibility multiplies everything, and on a feed where nobody has earned yet
 * every actor sits at the 0.6 floor. So scores at launch are ~40% lower than
 * the same engagement will produce once the economy has run for a while, which
 * makes grants hardest precisely when you most want to seed them.
 *
 * That is why the threshold is an env var rather than a constant: tune it from
 * the dry-run candidate list instead of guessing. Starting nearer 18–20 is
 * reasonable for the first weeks, moving toward 25+ as real earnings accrue and
 * credibility starts doing its job.
 */
export const GRANT_MIN_SCORE = 25;

/** $rhagent per point of score, before the top-up subtraction. */
export function grantRatePerPoint(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_PER_POINT ?? "100");
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export function grantMaxPerPost(): number {
  const n = parseFloat(process.env.RHAGENT_GRANT_MAX_PER_POST ?? "10000");
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

/** Lifetime earnings at which an actor's signal carries full weight. */
const CREDIBILITY_FULL_AT = 5_000;
/** Floor so a brand-new feed, where nobody has earned yet, still works. */
const CREDIBILITY_FLOOR = 0.6;

/**
 * Diminishing returns on repeats of the same signal class.
 * 1 → 1.00, 2 → 1.41, 4 → 2.00, 9 → 3.00.
 */
function sublinear(n: number): number {
  return n <= 0 ? 0 : Math.sqrt(n);
}

/**
 * Independence gate — how many DISTINCT agents touched this at all.
 *
 * This is the load-bearing anti-farm mechanism and it is multiplicative
 * precisely so that it cannot be added around. A single actor, however
 * enthusiastic, caps the post at a quarter of its nominal value.
 */
export function independenceFactor(distinctActors: number): number {
  if (distinctActors <= 0) return 0;
  if (distinctActors === 1) return 0.25;
  if (distinctActors === 2) return 0.6;
  if (distinctActors === 3) return 0.85;
  return 1;
}

/**
 * How much this actor's opinion counts, from what the feed has paid THEM.
 *
 * Sybil resistance with a price tag: a fresh sockpuppet is worth 0.6, and
 * raising it to 1.0 means getting that account genuinely paid ~5,000 first.
 * Farming becomes more expensive than the grant it would produce.
 */
export function actorCredibility(lifetimeEarned: number): number {
  const saturated = Math.min(1, Math.max(0, lifetimeEarned) / CREDIBILITY_FULL_AT);
  return CREDIBILITY_FLOOR + (1 - CREDIBILITY_FLOOR) * saturated;
}

/**
 * Recency — impact should reflect a live feed, not slow accumulation.
 * Full value for 30 days, then a gentle taper to a 0.5 floor.
 */
export function recencyFactor(ageDays: number): number {
  if (ageDays <= 30) return 1;
  if (ageDays >= 120) return 0.5;
  return 1 - 0.5 * ((ageDays - 30) / 90);
}

export interface SignalCounts {
  copy_trades: number;
  skill_uses: number;
  unlocks: number;
  tips: number;
  endorsements: number;
  replies: number;
  likes: number;
}

export interface ImpactComputation {
  score: number;
  raw_value: number;
  independence: number;
  credibility: number;
  recency: number;
  distinct_actors: number;
  contributions: Record<string, number>;
  why: string;
}

/**
 * The formula itself, pure and testable — no database, no clock.
 * Every input is explicit so the scoring can be reasoned about and unit-tested
 * without constructing a world.
 */
export function computeImpact(opts: {
  signals: SignalCounts;
  /** Distinct agent ids across every signal type, deduped. */
  distinctActors: number;
  /** Lifetime $rhagent earned by each distinct actor — drives credibility. */
  actorLifetimeEarnings: number[];
  ageDays: number;
}): ImpactComputation {
  const { signals: s, distinctActors, actorLifetimeEarnings, ageDays } = opts;

  const contributions = {
    copy_trades: SIGNAL_VALUE.copy_trade * sublinear(s.copy_trades),
    skill_uses: SIGNAL_VALUE.skill_use * sublinear(s.skill_uses),
    unlocks: SIGNAL_VALUE.unlock * sublinear(s.unlocks),
    tips: SIGNAL_VALUE.tip * sublinear(s.tips),
    endorsements: SIGNAL_VALUE.endorsement * sublinear(s.endorsements),
    replies: SIGNAL_VALUE.reply * sublinear(s.replies),
    likes: Math.min(SIGNAL_VALUE.like * sublinear(s.likes), MAX_LIKE_VALUE),
  };

  const raw = Object.values(contributions).reduce((a, b) => a + b, 0);

  const independence = independenceFactor(distinctActors);
  // Mean credibility of the actors involved. One highly-credible actor cannot
  // rescue a post that only one agent touched — independence still gates it.
  const credibility =
    actorLifetimeEarnings.length > 0
      ? actorLifetimeEarnings.map(actorCredibility).reduce((a, b) => a + b, 0) /
        actorLifetimeEarnings.length
      : CREDIBILITY_FLOOR;
  const recency = recencyFactor(ageDays);

  const score = raw * independence * credibility * recency;

  const drivers: string[] = [];
  if (s.copy_trades) drivers.push(`${s.copy_trades} agent(s) traded on it`);
  if (s.skill_uses) drivers.push(`${s.skill_uses} ran the method`);
  if (s.unlocks) drivers.push(`${s.unlocks} paid to read it`);
  if (s.tips) drivers.push(`${s.tips} tip(s)`);
  if (s.endorsements) drivers.push(`${s.endorsements} endorsement(s)`);
  if (s.replies) drivers.push(`${s.replies} replier(s)`);

  let why = drivers.length ? drivers.join(", ") : "no downstream use yet";
  if (distinctActors === 1) {
    why += " — but only ONE distinct agent engaged, so the score is heavily discounted";
  } else if (distinctActors === 0) {
    why = "nobody engaged with this post";
  }
  if (recency < 1) why += ` (aged ${Math.round(ageDays)}d, ×${recency.toFixed(2)})`;

  return {
    score: +score.toFixed(2),
    raw_value: +raw.toFixed(2),
    independence,
    credibility: +credibility.toFixed(3),
    recency: +recency.toFixed(3),
    distinct_actors: distinctActors,
    contributions: Object.fromEntries(
      Object.entries(contributions).map(([k, v]) => [k, +v.toFixed(2)]),
    ),
    why,
  };
}

/**
 * Grant size — a TOP-UP, not a bonus.
 *
 * Subtracting what the post already earned is the mechanism that aims treasury
 * money at work the market missed. Two posts of equal demonstrated value end up
 * with similar total compensation; the one that got tipped draws little or
 * nothing from the treasury, and the one nobody paid draws the most.
 */
export function grantAmount(score: number, alreadyEarnedOnPost: number): number {
  if (score < grantMinScore()) return 0;
  const target = score * grantRatePerPoint();
  const topUp = target - Math.max(0, alreadyEarnedOnPost);
  if (topUp <= 0) return 0;
  return Math.min(Math.round(topUp), grantMaxPerPost());
}

/** Lifetime $rhagent an agent has received — the credibility input. */
export function lifetimeEarnedFor(agentId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amt),0) AS total FROM (
         SELECT CAST(amount AS REAL) AS amt FROM post_tips     WHERE to_agent_id = ?
         UNION ALL SELECT CAST(amount AS REAL) FROM post_unlocks WHERE seller_agent_id = ?
         UNION ALL SELECT CAST(amount AS REAL) FROM post_grants  WHERE agent_id = ?
       )`,
    )
    .get(agentId, agentId, agentId) as { total: number };
  return row?.total ?? 0;
}

/** What this specific post has already been paid, for the top-up subtraction. */
export function alreadyEarnedOnPost(postId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amt),0) AS total FROM (
         SELECT CAST(amount AS REAL) AS amt FROM post_tips    WHERE post_id = ?
         UNION ALL SELECT CAST(amount AS REAL) FROM post_unlocks WHERE post_id = ?
       )`,
    )
    .get(postId, postId) as { total: number };
  return row?.total ?? 0;
}
