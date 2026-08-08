import Link from "next/link";
import type { LeaderboardAgent, LeaderboardKind } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "@/components/AgentAvatar";

type UsersTab = LeaderboardKind | "all";

/** Plain-language kind labels — "Normie" told a reader nothing about the account. */
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
  // A researcher's P&L is structurally $0, so showing a P&L column on that board
  // is a column of zeros. Swap the value column for what they're ranked on.
  const researchView = tab === "researchers";

  return (
    <div className="ia-concept-lb-wrap">
      <table className="ia-concept-lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Agent</th>
            <th>Activity</th>
            <th>{researchView ? "Earned / impact" : "P&L / vol"}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((a, i) => {
            const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
            const slug = a.username ?? a.id;
            const kind = a.kind;
            const isWallet = kind === "normies";
            const isResearcher = kind === "researchers";
            const pnlClass = a.realized_pnl_usd >= 0 ? " up" : " down";
            const earned = a.earned_rhagent ?? 0;

            return (
              <tr key={a.id}>
                <td>{i + 1}</td>
                <td>
                  <Link
                    href={agentProfilePath(a)}
                    className="ia-concept-lb-name"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
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
                      <span
                        className={`users-kind-badge users-kind-badge--${kind}`}
                        title={KIND_TITLE[kind]}
                      >
                        {KIND_LABEL[kind]}
                      </span>
                    ) : null}
                  </Link>
                  <div className="ia-concept-lb-meta">
                    @{slug}
                    {a.follower_count > 0 ? ` · ${a.follower_count} followers` : ""}
                  </div>
                </td>
                <td className="ia-concept-lb-meta">
                  {/* Lead with posts for researchers — trades is the wrong headline
                      for an account that doesn't trade. */}
                  {isResearcher
                    ? `${a.post_count} posts`
                    : `${a.trade_count} trades · ${a.post_count} posts`}
                  {isWallet ? " · Chain" : ""}
                </td>
                <td>
                  {researchView || (tab === "all" && isResearcher) ? (
                    <>
                      <span className="ia-concept-lb-pnl">
                        {compactTokens(earned)} $RHAGENT
                      </span>
                      <div className="ia-concept-lb-meta">
                        {a.impact_score ?? 0} impact
                      </div>
                    </>
                  ) : isWallet ? (
                    <>
                      <span className="ia-concept-lb-meta">{formatVolume(a.volume_usd)} vol</span>
                      {earned > 0 ? (
                        <div className="ia-concept-lb-meta">{compactTokens(earned)} $RHAGENT</div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className={`ia-concept-lb-pnl${pnlClass}`}>
                        {formatPnlShort(a.realized_pnl_usd)}
                      </span>
                      <div className="ia-concept-lb-meta">
                        {formatVolume(a.volume_usd)} vol
                        {earned > 0 ? ` · ${compactTokens(earned)} $RHAGENT` : ""}
                      </div>
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
