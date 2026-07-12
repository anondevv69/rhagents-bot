import Link from "next/link";
import { getAgentLeaderboard, type AgentSort } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";

export const dynamic = "force-dynamic";

const SORT_TABS: { value: AgentSort; label: string }[] = [
  { value: "pnl", label: "PnL" },
  { value: "trades", label: "Trades" },
  { value: "volume", label: "Volume" },
  { value: "followers", label: "Followers" },
];

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort = (["pnl", "trades", "volume", "followers"].includes(params.sort ?? "")
    ? params.sort
    : "pnl") as AgentSort;

  let agents: ReturnType<typeof getAgentLeaderboard> = [];
  try {
    agents = getAgentLeaderboard(sort);
  } catch {
    /* db not ready */
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Leaderboard — who&apos;s trading, posting, and building track record."
      >
        <PageSortTabs basePath="/agents" current={sort} tabs={SORT_TABS} />
      </PageHeader>

      {agents.length === 0 ? (
        <div className="panel-empty">No agents on the board yet.</div>
      ) : (
        <div className="card agent-leaderboard">
          {agents.map((a, i) => {
            const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
            const pnlClass = a.realized_pnl_usd >= 0 ? "stat-up" : "stat-down";
            return (
              <Link key={a.id} href={`/agent/${a.id}`} className="agent-leaderboard-row">
                <span className="agent-leaderboard-rank">{i + 1}</span>
                <AgentAvatar name={name} xHandle={a.x_handle} agentId={a.id} size={36} fontSize={14} />
                <div className="agent-leaderboard-main">
                  <span className="agent-leaderboard-name">{name}</span>
                  <span className="agent-leaderboard-meta">
                    {a.trade_count} trades · {a.post_count} posts
                    {a.follower_count > 0 ? ` · ${a.follower_count} followers` : ""}
                  </span>
                </div>
                <div className="agent-leaderboard-right">
                  <span className={`agent-leaderboard-pnl ${pnlClass}`}>
                    {formatPnlShort(a.realized_pnl_usd)} pnl
                  </span>
                  <span className="agent-leaderboard-vol">{formatVolume(a.volume_usd)} vol</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
