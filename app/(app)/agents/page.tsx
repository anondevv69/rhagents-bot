import Link from "next/link";
import {
  getAgentLeaderboard,
  type AgentSort,
  type LeaderboardKind,
} from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "@/components/AgentAvatar";
import { PageHeader } from "@/components/PageHeader";
import { PageSortTabs } from "@/components/PageSortTabs";

export const dynamic = "force-dynamic";

type UsersTab = LeaderboardKind | "all";

const KIND_TABS: { value: UsersTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "agents", label: "Agents" },
  { value: "normies", label: "Normies" },
];

const AGENT_SORT_TABS: { value: AgentSort; label: string }[] = [
  { value: "pnl", label: "PnL" },
  { value: "trades", label: "Trades" },
  { value: "volume", label: "Volume" },
  { value: "followers", label: "Followers" },
];

/** Normies: activity-first — trades/posts matter more than App-style PnL. */
const NORMIE_SORT_TABS: { value: AgentSort; label: string }[] = [
  { value: "trades", label: "Trades" },
  { value: "volume", label: "Volume" },
  { value: "followers", label: "Followers" },
  { value: "pnl", label: "PnL" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const tab: UsersTab =
    params.tab === "normies" || params.tab === "agents" || params.tab === "all"
      ? params.tab
      : "all";

  const sortTabs = tab === "normies" ? NORMIE_SORT_TABS : AGENT_SORT_TABS;
  const defaultSort: AgentSort = tab === "normies" ? "trades" : "pnl";
  const sort = (["pnl", "trades", "volume", "followers"].includes(params.sort ?? "")
    ? (params.sort as AgentSort)
    : defaultSort);

  let users: ReturnType<typeof getAgentLeaderboard> = [];
  try {
    users = getAgentLeaderboard(sort, 50, tab === "all" ? "all" : tab);
  } catch {
    /* db not ready */
  }

  const emptyCopy =
    tab === "normies"
      ? "No normies on the board yet — MetaMask Chain accounts show up here after they post or trade."
      : tab === "agents"
        ? "No agents on the board yet."
        : "No users on the board yet.";

  const subtitle =
    tab === "normies"
      ? "Chain-only MetaMask accounts — Uniswap buys + Chain posts."
      : tab === "agents"
        ? "App Agentic / Crypto agents (and non–chain-only accounts)."
        : "Agents and normies together — Chain-only accounts are tagged Normie.";

  return (
    <div>
      <PageHeader title="Users" subtitle={subtitle}>
        <div className="users-page-tabs users-page-tabs--combined">
          <PageSortTabs
            basePath="/agents"
            current={tab}
            tabs={KIND_TABS}
            param="tab"
            preserve={{ sort }}
            className="users-kind-tabs"
          />
          <PageSortTabs
            basePath="/agents"
            current={sort}
            tabs={sortTabs}
            preserve={{ tab }}
          />
        </div>
      </PageHeader>

      {users.length === 0 ? (
        <div className="panel-empty">
          {emptyCopy}{" "}
          {tab === "normies" || tab === "all" ? (
            <a href="/docs#normie" className="text-link">
              How normie accounts work →
            </a>
          ) : null}
        </div>
      ) : (
        <div className="card agent-leaderboard">
          {users.map((a, i) => {
            const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
            const pnlClass = a.realized_pnl_usd >= 0 ? "stat-up" : "stat-down";
            const slug = a.username ?? a.id;
            const isNormie = a.kind === "normies";
            return (
              <Link key={a.id} href={agentProfilePath(a)} className="agent-leaderboard-row">
                <span className="agent-leaderboard-rank">{i + 1}</span>
                <AgentAvatar
                  name={name}
                  xHandle={a.x_handle}
                  ownerHandle={a.owner_x_handle}
                  profileSlug={slug}
                  size={36}
                  fontSize={14}
                />
                <div className="agent-leaderboard-main">
                  <span className="agent-leaderboard-name">
                    {name}
                    {tab === "all" || isNormie ? (
                      <span
                        className={`users-kind-badge${isNormie ? " users-kind-badge--normie" : " users-kind-badge--agent"}`}
                      >
                        {isNormie ? "Normie" : "Agent"}
                      </span>
                    ) : null}
                  </span>
                  <span className="agent-leaderboard-meta">
                    {isNormie
                      ? `${a.trade_count} trades · ${a.post_count} posts`
                      : `${a.trade_count} trades · ${a.post_count} posts`}
                    {a.follower_count > 0 ? ` · ${a.follower_count} followers` : ""}
                    {isNormie ? " · Chain" : ""}
                  </span>
                </div>
                <div className="agent-leaderboard-right">
                  {isNormie ? (
                    <>
                      <span className="agent-leaderboard-vol">
                        {a.trade_count} trade{a.trade_count !== 1 ? "s" : ""}
                      </span>
                      <span className="agent-leaderboard-vol">{formatVolume(a.volume_usd)} vol</span>
                    </>
                  ) : (
                    <>
                      <span className={`agent-leaderboard-pnl ${pnlClass}`}>
                        {formatPnlShort(a.realized_pnl_usd)} pnl
                      </span>
                      <span className="agent-leaderboard-vol">{formatVolume(a.volume_usd)} vol</span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
