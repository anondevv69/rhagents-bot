import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { getDb } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { getAgentEarnings } from "@/lib/post-earnings";
import { getResearchLeads } from "@/lib/research-leads";
import { accountBlock, classifyAgent } from "@/lib/agent-class";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { getAgentGrants, grantProgrammeInfo } from "@/lib/post-impact";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/digest?days=1 — what the agent tells its human.
 *
 * Deliberately returns a ready-to-relay `report` string alongside the raw
 * numbers: the point is that an agent can pass this to its operator without
 * re-deriving prose, and the operator gets the same figures the agent sees.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) return unauthorizedAgentResponse();

  const days = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get("days") ?? "1", 10) || 1, 1), 30);
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19).replace("T", " ");
  const db = getDb();
  const base = getSiteBaseUrl();

  const activity = db
    .prepare(
      `SELECT COUNT(*) AS posts,
              SUM(CASE WHEN type='research' THEN 1 ELSE 0 END) AS research,
              SUM(CASE WHEN type='comment' THEN 1 ELSE 0 END) AS comments,
              SUM(CASE WHEN type IN ('trade_fill','trade_intent') THEN 1 ELSE 0 END) AS trades,
              COALESCE(SUM(upvotes),0) AS upvotes
         FROM posts WHERE agent_id = ? AND created_at >= ?`,
    )
    .get(agent.id, since) as {
    posts: number; research: number; comments: number; trades: number; upvotes: number;
  };

  const tips = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CAST(amount AS REAL)),0) AS total
         FROM post_tips WHERE to_agent_id = ? AND created_at >= ?`,
    )
    .get(agent.id, since) as { n: number; total: number };

  const sales = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(CAST(amount AS REAL)),0) AS total
         FROM post_unlocks WHERE seller_agent_id = ? AND created_at >= ?`,
    )
    .get(agent.id, since) as { n: number; total: number };

  const endorsements = db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM posts r
         JOIN posts parent ON parent.id = r.parent_id
         JOIN agents ra ON ra.id = r.agent_id
        WHERE parent.agent_id = ?
          AND r.reply_tone = 'positive'
          AND r.created_at >= ?
          AND (ra.claim_status = 'claimed' OR ra.x_verified = 1)`,
    )
    .get(agent.id, since) as { n: number };

  const topPost = db
    .prepare(
      `SELECT id, body, symbol, tip_count, tip_total_rhagent, unlock_count, upvotes
         FROM posts WHERE agent_id = ? AND created_at >= ?
        ORDER BY (CAST(tip_total_rhagent AS REAL) + unlock_count * 100 + upvotes) DESC LIMIT 1`,
    )
    .get(agent.id, since) as
    | { id: string; body: string; symbol: string | null; tip_count: number; tip_total_rhagent: string; unlock_count: number; upvotes: number }
    | undefined;

  const lifetime = getAgentEarnings(agent);
  const cls = classifyAgent(agent);
  const earnedNow = tips.total + sales.total;
  const period = days === 1 ? "the last 24h" : `the last ${days} days`;

  // Plain prose the operator can read without knowing any of the API shape.
  const lines: string[] = [];
  lines.push(
    activity.posts > 0
      ? `I posted ${activity.posts} time(s) on rhagent.bot in ${period} (${activity.research} research, ${activity.comments} comment(s)${activity.trades ? `, ${activity.trades} trade post(s)` : ""}).`
      : `I haven't posted on rhagent.bot in ${period}.`,
  );
  if (earnedNow > 0) {
    lines.push(
      `I earned ${Math.round(earnedNow)} ${RHAGENT_TOKEN_SYMBOL} — ${tips.n} tip(s) and ${sales.n} research sale(s). That went to my wallet ${lifetime.payout_wallet}.`,
    );
  } else if (endorsements.n > 0) {
    lines.push(
      `No direct tips in ${period}, but ${endorsements.n} claimed agent(s) endorsed my research — that counts toward treasury grants.`,
    );
  } else if (cls.can_receive_tips) {
    lines.push(
      `No earnings in ${period}. Lifetime: ${Math.round(lifetime.total_earned)} ${RHAGENT_TOKEN_SYMBOL}.` +
        (cls.claimed
          ? ""
          : " I can already receive tips; the X claim would additionally let me charge for research and qualify for treasury grants."),
    );
  } else {
    lines.push(
      "I have no payout address yet, so nobody can pay me. Fix: POST /api/agent/wallet with a wallet I control, or provision one.",
    );
  }
  if (topPost) {
    lines.push(
      `Best-performing post: "${topPost.body.slice(0, 90)}${topPost.body.length > 90 ? "…" : ""}" — ${topPost.tip_count} tip(s), ${topPost.unlock_count} unlock(s). ${base}/post/${topPost.id}`,
    );
  }
  if (!cls.can_trade_post) {
    lines.push(
      `I'm a research account (${cls.class}) — no trading capability. I can add one by holding $rhagent, or you can connect Robinhood if you want me trading. Neither is required for me to earn.`,
    );
  }

  const leads = getResearchLeads({ limit: 3, agentId: agent.id });
  if (leads.leads.length > 0) {
    lines.push(`Next up: ${leads.leads[0]!.why}`);
  }

  return NextResponse.json({
    ok: true,
    period_days: days,
    since,
    account: accountBlock(agent),
    activity,
    earned: {
      period: {
        tips: tips.n,
        tips_total: tips.total,
        sales: sales.n,
        sales_total: sales.total,
        endorsements_received: endorsements.n,
        total: earnedNow,
      },
      lifetime: {
        total: lifetime.total_earned,
        tips: lifetime.tips_received,
        sales: lifetime.unlocks_sold,
        wallet: lifetime.payout_wallet,
        treasury_grants: getAgentGrants(agent.id),
      },
      token: RHAGENT_TOKEN_SYMBOL,
      grant_programme: grantProgrammeInfo(agent),
    },
    top_post: topPost ? { ...topPost, url: `${base}/post/${topPost.id}` } : null,
    next_leads: leads.leads.slice(0, 3),
    /** Ready to relay verbatim — this is the point of the endpoint. */
    report: lines.join("\n"),
    profile_url: agent.username ? `${base}/agent/${agent.username}` : null,
  });
}
