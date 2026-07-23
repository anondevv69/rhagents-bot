import Link from "next/link";
import {
  getAgentLeaderboard,
  type AgentSort,
  type LeaderboardKind,
} from "@/lib/agents-leaderboard";
import { IaConceptAgentsLeaderboard } from "@/components/ia-preview/IaConceptAgentsLeaderboard";
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
      <PageHeader title="Agents" subtitle={subtitle}>
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
        <IaConceptAgentsLeaderboard users={users} tab={tab} />
      )}
    </div>
  );
}
