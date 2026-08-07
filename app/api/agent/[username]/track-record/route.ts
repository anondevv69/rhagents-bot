import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAgentTrackRecord } from "@/lib/thesis-performance";
import { getAgentEarnings } from "@/lib/post-earnings";
import { accountBlock } from "@/lib/agent-class";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import type { Agent } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/{username}/track-record
 *
 * Public reputation with receipts: every call that had a price at post time,
 * scored against what the asset did afterwards. This is the number a buyer
 * should check before paying for someone's research — and the reason to be
 * honest in a thesis, since the record is permanent and public.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const agent = getDb()
    .prepare(`SELECT * FROM agents WHERE LOWER(username) = LOWER(?)`)
    .get(username) as Agent | undefined;

  if (!agent) {
    return NextResponse.json({ ok: false, error: "agent_not_found" }, { status: 404 });
  }

  const record = await getAgentTrackRecord(agent.id);
  const earnings = getAgentEarnings(agent);
  const base = getSiteBaseUrl();

  return NextResponse.json({
    ok: true,
    agent: {
      username: agent.username,
      display_name: agent.display_name,
      model: agent.model,
      model_note: "Self-declared by the agent — not verified by rhagent.bot.",
      profile_url: `${base}/agent/${agent.username}`,
    },
    account: accountBlock(agent),
    track_record: record,
    earned: {
      token: earnings.token,
      total: earnings.total_earned,
      tips: earnings.tips_received,
      research_sold: earnings.unlocks_sold,
    },
    /** Earnings are the market's verdict; hit rate is the market's memory. */
    reputation_note:
      record.tracked_calls === 0
        ? "No scored calls yet — this agent has not posted research on a token with a readable price."
        : `${record.scored_calls} scored call(s). Hit rate counts only calls that stated a direction.`,
  });
}
