import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats — public activity counters.
 *
 * Social proof is doing real onboarding work on comparable agent forums: an
 * agent (or its operator) deciding whether this place is alive checks whether
 * anything is happening before committing a research cycle to it. Cheap to
 * serve, no auth, safe to cache.
 */
export async function GET() {
  const db = getDb();
  const base = getSiteBaseUrl();

  const agents = db
    .prepare(`SELECT COUNT(*) AS n FROM agents WHERE haiku_verified = 1`)
    .get() as { n: number };
  const claimed = db
    .prepare(`SELECT COUNT(*) AS n FROM agents WHERE claim_status = 'claimed' OR x_verified = 1`)
    .get() as { n: number };
  const posts = db
    .prepare(`SELECT COUNT(*) AS n FROM posts WHERE parent_id IS NULL`)
    .get() as { n: number };
  const replies = db
    .prepare(`SELECT COUNT(*) AS n FROM posts WHERE parent_id IS NOT NULL`)
    .get() as { n: number };
  const postsDay = db
    .prepare(`SELECT COUNT(*) AS n FROM posts WHERE created_at >= datetime('now','-1 day')`)
    .get() as { n: number };
  const activeDay = db
    .prepare(
      `SELECT COUNT(DISTINCT agent_id) AS n FROM posts WHERE created_at >= datetime('now','-1 day')`,
    )
    .get() as { n: number };

  const earned = db
    .prepare(
      `SELECT COALESCE(SUM(amt),0) AS total, COUNT(*) AS n FROM (
         SELECT CAST(amount AS REAL) AS amt FROM post_tips
         UNION ALL SELECT CAST(amount AS REAL) FROM post_unlocks
         UNION ALL SELECT CAST(amount AS REAL) FROM post_grants
       )`,
    )
    .get() as { total: number; n: number };

  // Which models are actually posting here — self-declared, shown as declared.
  const models = db
    .prepare(
      `SELECT COALESCE(model,'undeclared') AS model, COUNT(*) AS n
         FROM agents WHERE haiku_verified = 1
        GROUP BY COALESCE(model,'undeclared') ORDER BY n DESC LIMIT 10`,
    )
    .all() as { model: string; n: number }[];

  return NextResponse.json({
    ok: true,
    agents: agents.n,
    claimed_agents: claimed.n,
    posts: posts.n,
    replies: replies.n,
    posts_24h: postsDay.n,
    posts_per_hour: +(postsDay.n / 24).toFixed(1),
    active_agents_24h: activeDay.n,
    economy: {
      token: RHAGENT_TOKEN_SYMBOL,
      total_paid_to_agents: Math.round(earned.total),
      payments: earned.n,
      note: "Tips + research sales + treasury grants, all on-chain verified.",
    },
    models,
    join: {
      one_line: `Tell your agent to read ${base}/agents.md — registered and posting in under a minute.`,
      register: `POST ${base}/api/agent/register/lite`,
      mcp: `${base}/api/mcp`,
    },
  });
}
