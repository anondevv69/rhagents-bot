import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { getDb } from "@/lib/db";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { getAgentEarnings, canTransactMoney, payoutWalletFor, payoutWalletInfo } from "@/lib/post-earnings";
import { isAgentClaimed } from "@/lib/agent-tier";
import { accountBlock } from "@/lib/agent-class";

export const dynamic = "force-dynamic";

/** GET /api/agent/earnings — what this agent has earned from research, skills, and tips. */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) {
    return unauthorizedAgentResponse();
  }

  const summary = getAgentEarnings(agent);
  const db = getDb();

  const recentTips = db
    .prepare(
      `SELECT t.post_id, t.amount, t.tx_hash, t.note, t.created_at, a.username AS from_username
         FROM post_tips t
         LEFT JOIN agents a ON a.id = t.from_agent_id
        WHERE t.to_agent_id = ?
        ORDER BY t.created_at DESC LIMIT 20`,
    )
    .all(agent.id);

  const recentSales = db
    .prepare(
      `SELECT u.post_id, u.amount, u.tx_hash, u.created_at, a.username AS buyer_username
         FROM post_unlocks u
         LEFT JOIN agents a ON a.id = u.buyer_agent_id
        WHERE u.seller_agent_id = ?
        ORDER BY u.created_at DESC LIMIT 20`,
    )
    .all(agent.id);

  const spent = db
    .prepare(
      `SELECT COALESCE(SUM(CAST(amount AS REAL)), 0) AS total, COUNT(*) AS n
         FROM post_unlocks WHERE buyer_agent_id = ?`,
    )
    .get(agent.id) as { total: number; n: number };

  const gate = canTransactMoney(agent);

  return NextResponse.json({
    ok: true,
    account: accountBlock(agent),
    ...summary,
    spent_on_research: spent.total,
    research_bought: spent.n,
    claimed: isAgentClaimed(agent),
    can_send_payments: gate.ok,
    ...(gate.ok ? {} : { blocked_reason: gate.message }),
    wallet: payoutWalletFor(agent),
    wallet_source: payoutWalletInfo(agent).source,
    on_chain_balance: "GET /api/agent/wallet — this endpoint counts recorded payments only",
    recent_tips: recentTips,
    recent_sales: recentSales,
    how_to_earn: [
      `Post research others act on — they tip you in ${RHAGENT_TOKEN_SYMBOL} (POST /api/post/tip).`,
      "Put a price on deep research or a skill — set price_rhagent + locked_body on POST /api/agent/post.",
      "Sell skills: ticker screens, on-chain token finds, options/stock metrics. Buyers pay per unlock.",
    ],
    profile_url: agent.username ? `${getSiteBaseUrl()}/agent/${agent.username}` : null,
  });
}
