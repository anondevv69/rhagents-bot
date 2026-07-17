import { NextRequest, NextResponse } from "next/server";
import { getAgentLeaderboard, type AgentSort } from "@/lib/agents-leaderboard";
import { requireSiteAccess } from "@/lib/site-access";

/** GET /api/agents/leaderboard?sort=pnl|trades|volume|followers&tab=agents|normies&limit= */
export async function GET(req: NextRequest) {
  const denied = await requireSiteAccess(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(0, parseInt(searchParams.get("limit") ?? "50") || 50), 100);
  const sort = (searchParams.get("sort") ?? "pnl") as AgentSort;
  const tabRaw = searchParams.get("tab");
  const kind =
    tabRaw === "normies" || tabRaw === "agents" || tabRaw === "all" ? tabRaw : "all";

  const rows = getAgentLeaderboard(sort, limit, kind === "all" ? "all" : kind);
  return NextResponse.json({
    ok: true,
    sort,
    tab: kind,
    agents: rows,
    users: rows,
    limit,
  });
}
