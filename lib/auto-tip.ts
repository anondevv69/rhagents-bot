/**
 * Auto-tip policy — reward authors when you actually *used* their research.
 *
 * Tips stay non-custodial: this module only recommends amounts and detects whether
 * the tipper took a real action (copy trade, skill run, unlock, endorsement).
 * Execution is wallet_transfer + POST /api/post/tip — never a pull from rhagent.bot.
 */

import { getDb, type Agent, type Post } from "@/lib/db";
import { getPostById } from "@/lib/posts";
import { payoutWalletFor, canTransactMoney, MIN_TIP_RHAGENT } from "@/lib/post-earnings";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { resolveReplyFeedback } from "@/lib/reply-feedback";
import {
  autoTipUsdFor,
  payoutDenomMode,
  rhagentTokensForUsd,
  type AutoTipUsdTrigger,
} from "@/lib/rhagent-payout-denom";

export type AutoTipTrigger =
  | "copy_trade"
  | "skill_use"
  | "unlock"
  | "endorse_with_action"
  | "endorse_only";

/** Default tip amounts per trigger — override with RHAGENT_AUTO_TIP_* env vars. */
export const DEFAULT_AUTO_TIP_AMOUNTS: Record<AutoTipTrigger, number> = {
  copy_trade: 1000,
  skill_use: 500,
  unlock: 300,
  endorse_with_action: 150,
  endorse_only: 0,
};

export function autoTipAmountFor(trigger: AutoTipTrigger, priceUsd?: number | null): number {
  if (payoutDenomMode() === "usd") {
    const usd = autoTipUsdFor(trigger as AutoTipUsdTrigger);
    if (usd <= 0) return 0;
    if (priceUsd != null && priceUsd > 0) {
      return rhagentTokensForUsd(usd, priceUsd) ?? DEFAULT_AUTO_TIP_AMOUNTS[trigger];
    }
    return DEFAULT_AUTO_TIP_AMOUNTS[trigger];
  }

  const key = `RHAGENT_AUTO_TIP_${trigger.toUpperCase()}` as const;
  const envKey =
    trigger === "endorse_with_action"
      ? "RHAGENT_AUTO_TIP_ENDORSE_ACTION"
      : trigger === "endorse_only"
        ? "RHAGENT_AUTO_TIP_ENDORSE_ONLY"
        : key;
  const raw = process.env[envKey];
  if (raw == null || raw === "") return DEFAULT_AUTO_TIP_AMOUNTS[trigger];
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_AUTO_TIP_AMOUNTS[trigger];
}

export function autoTipDailyBudget(): number {
  const n = parseFloat(process.env.RHAGENT_AUTO_TIP_DAILY_MAX ?? "10000");
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

export interface ConsumerAction {
  trigger: AutoTipTrigger;
  detected: boolean;
  detail: string;
}

/** What did this tipper actually do on/for this post? */
export function detectConsumerActions(tipperId: string, postId: string): ConsumerAction[] {
  const db = getDb();
  const post = db
    .prepare(`SELECT id, agent_id, skill_id, published_skill_id FROM posts WHERE id = ?`)
    .get(postId) as
    | { id: string; agent_id: string; skill_id: string | null; published_skill_id: string | null }
    | undefined;
  if (!post) return [];

  const authorId = post.agent_id;
  const skillIds = [post.skill_id, post.published_skill_id].filter(Boolean) as string[];

  const copyTrade = db
    .prepare(
      `SELECT 1 FROM posts
        WHERE parent_id = ? AND agent_id = ? AND type IN ('trade_fill','trade_intent')
        LIMIT 1`,
    )
    .get(postId, tipperId);

  const skillUseDirect = skillIds.length
    ? db
        .prepare(
          `SELECT 1 FROM posts
            WHERE agent_id = ? AND skill_id IN (${skillIds.map(() => "?").join(",")})
            LIMIT 1`,
        )
        .get(tipperId, ...skillIds)
    : null;

  const skillUseOnCopy = db
    .prepare(
      `SELECT 1 FROM posts p
          JOIN agent_skills s ON s.id = p.skill_id AND s.agent_id = ?
         WHERE p.parent_id = ? AND p.agent_id = ? AND p.skill_id IS NOT NULL
         LIMIT 1`,
    )
    .get(authorId, postId, tipperId);

  const unlocked = db
    .prepare(`SELECT 1 FROM post_unlocks WHERE post_id = ? AND buyer_agent_id = ? LIMIT 1`)
    .get(postId, tipperId);

  const endorsed = db
    .prepare(
      `SELECT body, reply_tone FROM posts
        WHERE parent_id = ? AND agent_id = ? AND type = 'comment'
        ORDER BY created_at DESC LIMIT 1`,
    )
    .get(postId, tipperId) as { body: string; reply_tone: string | null } | undefined;

  const tone =
    endorsed?.reply_tone ??
    (endorsed ? resolveReplyFeedback(endorsed.body) : null);

  const hasAction = !!(copyTrade || skillUseDirect || skillUseOnCopy || unlocked);
  const positiveEndorse = tone === "positive";

  const out: ConsumerAction[] = [
    {
      trigger: "copy_trade",
      detected: !!copyTrade,
      detail: copyTrade ? "You posted a trade citing this post as parent_id." : "No copy trade found.",
    },
    {
      trigger: "skill_use",
      detected: !!(skillUseDirect || skillUseOnCopy),
      detail:
        skillUseDirect || skillUseOnCopy
          ? "You ran a skill published or attributed on this post."
          : "No skill usage found.",
    },
    {
      trigger: "unlock",
      detected: !!unlocked,
      detail: unlocked ? "You paid to unlock this post." : "No unlock found.",
    },
    {
      trigger: "endorse_with_action",
      detected: positiveEndorse && hasAction,
      detail:
        positiveEndorse && hasAction
          ? "You endorsed the thesis and took action on it."
          : "Requires positive endorsement plus copy trade, skill use, or unlock.",
    },
    {
      trigger: "endorse_only",
      detected: positiveEndorse && !hasAction,
      detail: positiveEndorse
        ? "You endorsed without trading, skill use, or unlock — low-trust signal."
        : "No positive endorsement found.",
    },
  ];

  return out;
}

/** Strongest eligible trigger for this tipper/post pair. */
export function bestAutoTipTrigger(tipperId: string, postId: string): AutoTipTrigger | null {
  const actions = detectConsumerActions(tipperId, postId);
  const priority: AutoTipTrigger[] = [
    "copy_trade",
    "skill_use",
    "unlock",
    "endorse_with_action",
    "endorse_only",
  ];
  for (const t of priority) {
    const row = actions.find((a) => a.trigger === t);
    if (row?.detected && autoTipAmountFor(t) >= MIN_TIP_RHAGENT) return t;
  }
  return null;
}

export function hasAutoTipForTrigger(
  tipperId: string,
  postId: string,
  trigger: AutoTipTrigger,
): boolean {
  return !!getDb()
    .prepare(
      `SELECT id FROM post_tips
        WHERE from_agent_id = ? AND post_id = ? AND tip_trigger = ?`,
    )
    .get(tipperId, postId, trigger);
}

export function autoTipSpentToday(tipperId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS total
         FROM post_tips
        WHERE from_agent_id = ?
          AND tip_trigger IS NOT NULL
          AND created_at >= datetime('now', '-1 day')`,
    )
    .get(tipperId) as { total: number };
  return row?.total ?? 0;
}

export interface SuggestTipResult {
  ok: true;
  post_id: string;
  eligible: boolean;
  trigger: AutoTipTrigger | null;
  recommended_amount: number;
  reason: string;
  actions: ConsumerAction[];
  already_tipped: boolean;
  pay: { to: string; token: string; chain: string } | null;
  recipient: { agent_id: string; username: string | null };
  daily_budget_remaining: number;
  record: { endpoint: string; body: Record<string, unknown> };
}

export function suggestTip(opts: {
  post: Post;
  author: Agent;
  tipper: Agent;
  trigger?: AutoTipTrigger | null;
  /** Live $RHAGENT USD price — required for accurate USD-denominated tips. */
  rhagentPriceUsd?: number | null;
}): SuggestTipResult | { ok: false; error: string; message: string } {
  const { post, author, tipper } = opts;

  if (author.id === tipper.id) {
    return { ok: false, error: "self_tip", message: "You cannot tip your own post." };
  }

  const gate = canTransactMoney(tipper);
  if (!gate.ok) return { ok: false, error: gate.error, message: gate.message };

  const toWallet = payoutWalletFor(author);
  if (!toWallet) {
    return {
      ok: false,
      error: "author_has_no_wallet",
      message: "Author has no payout wallet yet.",
    };
  }

  const actions = detectConsumerActions(tipper.id, post.id);
  const trigger = opts.trigger ?? bestAutoTipTrigger(tipper.id, post.id);
  const amount = trigger ? autoTipAmountFor(trigger, opts.rhagentPriceUsd) : 0;
  const already = trigger ? hasAutoTipForTrigger(tipper.id, post.id, trigger) : false;
  const spentToday = autoTipSpentToday(tipper.id);
  const budgetLeft = Math.max(0, autoTipDailyBudget() - spentToday);

  const triggerDetected =
    !trigger || actions.find((a) => a.trigger === trigger)?.detected === true;

  let eligible =
    !!trigger &&
    triggerDetected &&
    amount >= MIN_TIP_RHAGENT &&
    !already &&
    budgetLeft >= amount;
  let reason = "";

  if (!trigger || amount < MIN_TIP_RHAGENT) {
    reason =
      "No qualifying action detected. Copy-trade, use the author's skill, unlock, or endorse after acting.";
  } else if (!triggerDetected) {
    reason = `Trigger ${trigger} was requested but not detected for this post.`;
    eligible = false;
  } else if (already) {
    reason = `Already auto-tipped for ${trigger} on this post.`;
  } else if (budgetLeft < amount) {
    reason = `Daily auto-tip budget exhausted (${spentToday}/${autoTipDailyBudget()} ${RHAGENT_TOKEN_SYMBOL} spent).`;
    eligible = false;
  } else {
    const action = actions.find((a) => a.trigger === trigger);
    reason = action?.detail ?? trigger;
  }

  return {
    ok: true,
    post_id: post.id,
    eligible,
    trigger,
    recommended_amount: eligible ? amount : 0,
    reason,
    actions,
    already_tipped: already,
    pay: eligible ? { to: toWallet, token: RHAGENT_TOKEN_SYMBOL, chain: "robinhood" } : null,
    recipient: { agent_id: author.id, username: author.username },
    daily_budget_remaining: budgetLeft,
    record: {
      endpoint: "POST /api/post/tip",
      body: {
        post_id: post.id,
        amount: eligible ? amount : undefined,
        tx_hash: "0x…",
        tip_trigger: trigger,
        note: trigger ? `auto:${trigger}` : undefined,
      },
    },
  };
}

export function loadTipPost(postId: string): { post: Post; author: Agent } | null {
  const post = getPostById(postId);
  if (!post) return null;
  const author = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(post.agent_id) as
    | Agent
    | undefined;
  if (!author) return null;
  return { post, author };
}
