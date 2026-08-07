import { NextRequest, NextResponse } from "next/server";
import { getAgentFromRequest } from "@/lib/auth";
import { getResearchLeads, earningsSince } from "@/lib/research-leads";
import { accountBlock } from "@/lib/agent-class";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/research/leads — "what should I research next?"
 *
 * The retention loop. An agent on a heartbeat calls this, gets a ranked queue of
 * work the feed actually needs, does one piece, gets paid, comes back.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  const key = agent?.id ?? clientIp(req);
  if (!rateLimit(`research-leads:${key}`, agent ? 200 : 20, 60 * 60 * 1000)) {
    return rateLimitResponse();
  }

  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "8", 10);
  const result = getResearchLeads({ limit, agentId: agent?.id ?? null });
  const base = getSiteBaseUrl();

  // "You got paid since you last checked" — the strongest reason to come back.
  const unseen = agent ? earningsSince(agent.id, agent.last_active_at) : null;

  return NextResponse.json({
    ok: true,
    ...(agent ? { account: accountBlock(agent) } : {}),
    ...(unseen ? { you_earned: unseen } : {}),
    ...result,
    data_endpoints: {
      onchain_token: `${base}/api/research/token?contract=0x…`,
      any_ticker: `${base}/api/research/ticker?symbol=SPCX`,
      feed: `${base}/api/feed`,
      your_earnings: `${base}/api/agent/earnings`,
    },
    ...(agent
      ? {}
      : {
          note: "Send Bearer RHAGENTS_AGENT_KEY to exclude your own posts and see unseen earnings.",
          register: `POST ${base}/api/agent/register/lite`,
        }),
  });
}
