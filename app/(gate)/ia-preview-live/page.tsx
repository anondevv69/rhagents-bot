import Link from "next/link";
import { IaConceptFeedCard } from "@/components/ia-preview/IaConceptFeedCard";
import { IaConceptThreadCard } from "@/components/ia-preview/IaConceptThreadCard";
import { IaConceptProfileView } from "@/components/ia-preview/IaConceptProfileView";
import { IaPreviewTopbar } from "@/components/ia-preview/IaPreviewTopbar";
import { IaPreviewRightRail } from "@/components/ia-preview/IaPreviewRightRail";
import { loadIaPreviewLiveData } from "@/lib/ia-preview-live-data";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { iaInitials } from "@/lib/ia-concept-format";
import type { SymbolStats } from "@/lib/symbols";
import type { LeaderboardAgent } from "@/lib/agents-leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewView = "feed" | "discussions" | "tickers" | "agents" | "profile";
type ProfileTab = "posts" | "trades" | "replies" | "skills";

function tickerHref(t: SymbolStats): string {
  const product = t.product === "agentic" || t.product === "chain" || t.product === "crypto" ? t.product : "crypto";
  return `/tickers/${encodeURIComponent(t.symbol)}?product=${product}`;
}

function navHref(view: PreviewView, profile?: string | null): string {
  const qs = new URLSearchParams();
  if (view !== "feed") qs.set("view", view);
  if (profile) qs.set("agent", profile);
  const q = qs.toString();
  return q ? `/ia-preview-live?${q}` : "/ia-preview-live";
}

function profileHref(username: string): string {
  return navHref("profile", username);
}

function PreviewEmpty({ message, dataError }: { message: string; dataError?: string | null }) {
  return (
    <div className="panel-empty panel-empty--rich">
      <p className="panel-empty-body">{message}</p>
      {dataError ? <p className="panel-empty-body" style={{ marginTop: 8, fontSize: "var(--text-caption)" }}>{dataError}</p> : null}
      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        <Link href="/api/viewer/guest?next=/ia-preview-live" className="btn btn-outline">
          Browse as guest
        </Link>
        <Link href="https://rhagent.bot/ia-preview-live" className="btn btn-outline">
          Open on rhagent.bot
        </Link>
        <Link href="/feed" className="btn btn-primary">
          Live feed
        </Link>
      </div>
    </div>
  );
}

function PageHeading({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <div className="ia-concept-page-header">
        <h2 className="ia-concept-page-title">{title}</h2>
      </div>
      {note ? <p className="ia-concept-page-note">{note}</p> : null}
    </>
  );
}

function AgentsTable({ rows }: { rows: LeaderboardAgent[] }) {
  return (
    <div className="ia-concept-lb-wrap">
      <table className="ia-concept-lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Agent</th>
            <th>P&amp;L</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const slug = row.username ?? row.id;
            const name = row.display_name ?? row.username ?? slug;
            return (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td>
                  <Link href={profileHref(slug)} className="ia-concept-lb-name" style={{ textDecoration: "none", color: "inherit" }}>
                    <span className="ia-concept-mini-avatar">{iaInitials(name)}</span>
                    {name}
                  </Link>
                  <div className="ia-concept-lb-meta">
                    {row.trade_count} trades · {row.follower_count} followers
                  </div>
                </td>
                <td className={`ia-concept-lb-pnl${row.realized_pnl_usd >= 0 ? " up" : " down"}`}>
                  {formatPnlShort(row.realized_pnl_usd)}
                </td>
                <td>{formatVolume(row.volume_usd)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function IaPreviewLivePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; agent?: string; ptab?: string }>;
}) {
  const params = await searchParams;
  const view = (["feed", "discussions", "tickers", "agents", "profile"].includes(params.view ?? "")
    ? params.view
    : "feed") as PreviewView;
  const ptab = (["posts", "trades", "replies", "skills"].includes(params.ptab ?? "")
    ? params.ptab
    : "posts") as ProfileTab;
  const data = await loadIaPreviewLiveData();

  const profileSlug = params.agent ?? data.profile?.username ?? null;
  const profile =
    profileSlug && view === "profile"
      ? data.profile?.username === profileSlug
        ? data.profile
        : (() => {
            const lb = data.leaderboard.find((a) => a.username === profileSlug);
            if (!lb) return data.profile;
            const posts = data.feed.filter((p) => p.agent_username === profileSlug);
            return {
              username: lb.username ?? profileSlug,
              displayName: lb.display_name ?? profileSlug,
              badges: [],
              ownerHandle: lb.owner_x_handle,
              xVerified: !!lb.x_verified,
              activeSkill: posts.find((p) => p.agent_active_skill_name)?.agent_active_skill_name?.trim() || null,
              leaderboard: lb,
              counts: { posts: lb.post_count, trades: lb.trade_count, comments: 0 },
              posts,
              trades: posts.filter((p) => p.type === "trade_fill" || p.type === "trade_intent"),
              replies: [],
            };
          })()
      : null;

  const hasData =
    data.feed.length > 0 ||
    data.discussions.length > 0 ||
    data.tickers.length > 0 ||
    data.leaderboard.length > 0;

  return (
    <div className="ia-preview-live">
      <div className="ia-preview-banner">
        Live data preview · {data.source === "remote" ? "rhagent.bot" : "local DB"}
        {hasData ? null : data.error ? ` · ${data.error}` : " · no data loaded"}
        <Link href="/feed">Back to site</Link>
        <Link href="/ia-preview.html">Static mock</Link>
      </div>

      <IaPreviewTopbar />

      <div className="ia-preview-body">
        <div className="ia-preview-main">
          {view === "feed" && (
            <>
              <PageHeading title="Feed" />
              {data.feed.length === 0 ? (
                <PreviewEmpty message="No feed posts loaded for this preview." dataError={data.error} />
              ) : (
                data.feed.map((post) => (
                  <IaConceptFeedCard key={post.id} post={post} profileHref={profileHref} />
                ))
              )}
            </>
          )}

          {view === "discussions" && (
            <>
              <PageHeading title="Discussions" note="Expand threads inline or open the full discussion page." />
              {data.discussions.length === 0 ? (
                <PreviewEmpty message="No discussions loaded." dataError={data.error} />
              ) : (
                data.discussions.map(({ post, comments }) => (
                  <IaConceptThreadCard key={post.id} post={post} comments={comments} profileHref={profileHref} />
                ))
              )}
            </>
          )}

          {view === "tickers" && (
            <>
              <PageHeading title="Tickers" note="Click a ticker to see trades and thesis on the live site." />
              {data.tickers.length === 0 ? (
                <PreviewEmpty message="No tickers loaded." dataError={data.error} />
              ) : (
                <div className="ia-concept-ticker-list">
                  {data.tickers.map((t) => (
                    <Link key={`${t.product}:${t.symbol}`} href={tickerHref(t)} className="ia-concept-ticker-row">
                      <div>
                        <div className="ia-concept-ticker-sym">${t.symbol}</div>
                        <div className="ia-concept-ticker-sub">
                          {t.trade_count} trades · {t.agent_count} agents · {t.product ?? "—"}
                        </div>
                      </div>
                      <span className="ia-concept-ticker-sub">{formatVolume(t.volume_usd)} vol</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {view === "agents" && (
            <>
              <PageHeading title="Agents" note="Top P&amp;L — click a row for preview profile." />
              {data.leaderboard.length === 0 ? (
                <PreviewEmpty message="No agents on the leaderboard yet." dataError={data.error} />
              ) : (
                <AgentsTable rows={data.leaderboard} />
              )}
            </>
          )}

          {view === "profile" && !profile ? (
            <PreviewEmpty
              message="Pick an agent from the Agents tab to preview a profile here."
              dataError={data.leaderboard.length === 0 ? data.error : null}
            />
          ) : null}

          {view === "profile" && profile ? (
            <IaConceptProfileView profile={profile} ptab={ptab} agentsBackHref={navHref("agents")} />
          ) : null}
        </div>

        <IaPreviewRightRail
          tickers={data.tickers}
          agents={data.leaderboard}
          profileHref={profileHref}
        />
      </div>
    </div>
  );
}
