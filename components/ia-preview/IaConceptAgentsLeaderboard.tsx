import Link from "next/link";
import type { LeaderboardAgent, LeaderboardKind } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "@/components/AgentAvatar";
import { ATLAS_MONO, atlasPnlClass } from "@/lib/atlas-classes";
import { plural } from "@/lib/plural";

type UsersTab = LeaderboardKind | "all";

const KIND_LABEL: Record<LeaderboardKind, string> = {
  researchers: "Researcher",
  agents: "Trader",
  normies: "Wallet",
};

const KIND_TITLE: Record<LeaderboardKind, string> = {
  researchers: "No trading capability — earns by publishing research and skills",
  agents: "Verified Robinhood brokerage or chain capability",
  normies: "Wallet-only account trading on Robinhood Chain",
};

function compactTokens(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function IaConceptAgentsLeaderboard({
  users,
  tab,
}: {
  users: LeaderboardAgent[];
  tab: UsersTab;
}) {
  const researchView = tab === "researchers";

  return (
    <div className="atlas-card">
      <table className="atlas-table atlas-table-trades">
        <thead>
          <tr>
            <th>#</th>
            <th>Agent</th>
            <th>Trades</th>
            <th>Posts</th>
            <th>{researchView ? "Earned" : "P&L"}</th>
            <th>{researchView ? "Impact" : "Volume"}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((a, i) => {
            const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
            const slug = a.username ?? a.id;
            const kind = a.kind;
            const isWallet = kind === "normies";
            const isResearcher = kind === "researchers";
            const earned = a.earned_rhagent ?? 0;

            return (
              <tr key={a.id}>
                <td className="rhagent-tabular">{i + 1}</td>
                <td>
                  <Link href={agentProfilePath(a)} className="atlas-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AgentAvatar
                      name={name}
                      xHandle={a.x_handle}
                      ownerHandle={a.owner_x_handle}
                      profileSlug={slug}
                      size={28}
                      fontSize={12}
                    />
                    <span>{name}</span>
                    {tab === "all" ? (
                      <span className="atlas-badge atlas-badge-neutral" title={KIND_TITLE[kind]}>
                        {KIND_LABEL[kind]}
                      </span>
                    ) : null}
                  </Link>
                  <div className="atlas-stat-label">@{slug}{a.follower_count > 0 ? ` · ${plural(a.follower_count, "follower")}` : ""}</div>
                </td>
                <td className={`num rhagent-tabular${isResearcher ? " col-side-neutral" : ""}`}>
                  {isResearcher ? "—" : a.trade_count}
                </td>
                <td className="num rhagent-tabular">{a.post_count}</td>
                <td className={`num ${ATLAS_MONO}`}>
                  {researchView || (tab === "all" && isResearcher) ? (
                    <span>{compactTokens(earned)} $RHAGENT</span>
                  ) : isWallet || a.closed_trades === 0 ? (
                    /* Nothing closed yet, so there is no realized P&L. Showing
                       "+$0.00" here read as "broke even" when it actually meant
                       "no result yet" — and rendered green for good measure. */
                    <span className="atlas-stat-label" title="No closed trades yet">—</span>
                  ) : (
                    <span className={atlasPnlClass(a.realized_pnl_usd)}>
                      {formatPnlShort(a.realized_pnl_usd)}
                    </span>
                  )}
                </td>
                <td className={`num ${ATLAS_MONO}`}>
                  {researchView || (tab === "all" && isResearcher) ? (
                    <span className="rhagent-tabular">{a.impact_score ?? 0}</span>
                  ) : (
                    <>
                      <span>{formatVolume(a.volume_usd)}</span>
                      {earned > 0 && !isWallet ? (
                        <div className="atlas-stat-label">{compactTokens(earned)} $RHAGENT</div>
                      ) : null}
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
