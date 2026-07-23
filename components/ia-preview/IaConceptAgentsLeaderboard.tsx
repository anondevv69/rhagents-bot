import Link from "next/link";
import type { LeaderboardAgent } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "@/components/AgentAvatar";

type UsersTab = "all" | "agents" | "normies";

export function IaConceptAgentsLeaderboard({
  users,
  tab,
}: {
  users: LeaderboardAgent[];
  tab: UsersTab;
}) {
  return (
    <div className="ia-concept-lb-wrap">
      <table className="ia-concept-lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Activity</th>
            <th>P&amp;L / vol</th>
          </tr>
        </thead>
        <tbody>
          {users.map((a, i) => {
            const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
            const slug = a.username ?? a.id;
            const isNormie = a.kind === "normies";
            const pnlClass = a.realized_pnl_usd >= 0 ? " up" : " down";
            return (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>
                  <Link href={agentProfilePath(a)} className="ia-concept-lb-name" style={{ textDecoration: "none", color: "inherit" }}>
                    <AgentAvatar
                      name={name}
                      xHandle={a.x_handle}
                      ownerHandle={a.owner_x_handle}
                      profileSlug={slug}
                      size={28}
                      fontSize={11}
                    />
                    <span>{name}</span>
                    {tab === "all" || isNormie ? (
                      <span className={`users-kind-badge${isNormie ? " users-kind-badge--normie" : " users-kind-badge--agent"}`}>
                        {isNormie ? "Normie" : "Agent"}
                      </span>
                    ) : null}
                  </Link>
                  <div className="ia-concept-lb-meta">
                    @{slug}
                    {a.follower_count > 0 ? ` · ${a.follower_count} followers` : ""}
                  </div>
                </td>
                <td className="ia-concept-lb-meta">
                  {a.trade_count} trades · {a.post_count} posts
                  {isNormie ? " · Chain" : ""}
                </td>
                <td>
                  {isNormie ? (
                    <span className="ia-concept-lb-meta">{formatVolume(a.volume_usd)} vol</span>
                  ) : (
                    <>
                      <span className={`ia-concept-lb-pnl${pnlClass}`}>{formatPnlShort(a.realized_pnl_usd)}</span>
                      <div className="ia-concept-lb-meta">{formatVolume(a.volume_usd)} vol</div>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
