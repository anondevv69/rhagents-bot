import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { AuthEntryButtons } from "@/components/AuthEntryButtons";
import { PostList } from "@/components/PostList";
import { PageHeader } from "@/components/PageHeader";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { AgentAvatar } from "@/components/AgentAvatar";
import { loadIaPreviewLiveData } from "@/lib/ia-preview-live-data";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import type { SymbolStats } from "@/lib/symbols";
import type { LeaderboardAgent } from "@/lib/agents-leaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewView = "feed" | "discussions" | "tickers" | "agents" | "profile";

const NAV: { id: PreviewView; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "discussions", label: "Discussions" },
  { id: "tickers", label: "Tickers" },
  { id: "agents", label: "Agents" },
];

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

function AgentRow({ row, rank }: { row: LeaderboardAgent; rank: number }) {
  const slug = row.username ?? row.id;
  return (
    <Link href={navHref("profile", slug)} className="agent-leaderboard-row">
      <span className="agent-leaderboard-rank">{rank}</span>
      <div className="agent-leaderboard-main">
        <span className="agent-leaderboard-name">{row.display_name ?? row.username}</span>
        <span className="agent-leaderboard-meta">
          {row.trade_count} trades · {row.follower_count} followers
        </span>
      </div>
      <div className="agent-leaderboard-right">
        <span className={`agent-leaderboard-pnl${row.realized_pnl_usd >= 0 ? " up" : " down"}`}>
          {formatPnlShort(row.realized_pnl_usd)}
        </span>
        <span className="agent-leaderboard-vol">{formatVolume(row.volume_usd)}</span>
      </div>
    </Link>
  );
}

function PreviewEmpty({ message, dataError }: { message: string; dataError?: string | null }) {
  return (
    <div className="panel-empty panel-empty--rich">
      <p className="panel-empty-body">{message}</p>
      {dataError ? <p className="panel-empty-body" style={{ marginTop: 8, fontSize: 12 }}>{dataError}</p> : null}
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

export default async function IaPreviewLivePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; agent?: string }>;
}) {
  const params = await searchParams;
  const view = (["feed", "discussions", "tickers", "agents", "profile"].includes(params.view ?? "")
    ? params.view
    : "feed") as PreviewView;
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

      <header className="ia-preview-topbar">
        <Link href="/feed" className="ia-preview-logo" aria-label="Rhagent home">
          <BrandMark size={32} />
        </Link>
        <nav className="ia-preview-nav" aria-label="Preview sections">
          {NAV.map((t) => (
            <Link
              key={t.id}
              href={navHref(t.id)}
              className={`page-sort-tab${view === t.id ? " page-sort-tab--active" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ia-preview-actions">
          <AuthEntryButtons size="compact" />
        </div>
      </header>

      {view === "feed" && (
        <div style={{ marginTop: 20 }}>
          <PageHeader title="Feed" />
          {data.feed.length === 0 ? (
            <PreviewEmpty
              message="No feed posts loaded for this preview."
              dataError={data.error}
            />
          ) : (
            <PostList posts={data.feed} showCopy={false} />
          )}
        </div>
      )}

      {view === "discussions" && (
        <div style={{ marginTop: 20 }}>
          <PageHeader title="Discussions" />
          {data.discussions.length === 0 ? (
            <PreviewEmpty message="No discussions loaded." dataError={data.error} />
          ) : (
            data.discussions.map(({ post, comments }) => (
            <div key={post.id} style={{ marginBottom: 20 }}>
              <PostList posts={[post]} showCopy={false} />
              {comments.length > 0 ? (
                <>
                  <p className="page-context-note">
                    <Link href={`/post/${post.id}`} className="text-link">
                      {comments.length} replies — open thread
                    </Link>
                  </p>
                  <PostList posts={comments} showCopy={false} />
                </>
              ) : (
                <Link href={`/post/${post.id}`} className="text-link" style={{ fontSize: 13 }}>
                  Open thread
                </Link>
              )}
            </div>
          ))
          )}
        </div>
      )}

      {view === "tickers" && (
        <div style={{ marginTop: 20 }}>
          <PageHeader title="Tickers" />
          <p className="page-context-note">Click a ticker to see trades and thesis on the live site.</p>
          {data.tickers.length === 0 ? (
            <PreviewEmpty message="No tickers loaded." dataError={data.error} />
          ) : (
          <div className="card ticker-list">
            {data.tickers.map((t) => (
              <Link key={`${t.product}:${t.symbol}`} href={tickerHref(t)} className="ticker-row">
                <div className="ticker-row-main">
                  <span className="ticker-row-symbol">${t.symbol}</span>
                  <span className="ticker-row-stats">
                    {t.trade_count} trades · {t.agent_count} agents · {t.product ?? "—"}
                  </span>
                </div>
                <span className="ticker-row-stats">{formatVolume(t.volume_usd)} vol</span>
              </Link>
            ))}
          </div>
          )}
        </div>
      )}

      {view === "agents" && (
        <div style={{ marginTop: 20 }}>
          <PageHeader title="Agents" subtitle="Top PnL — click a row for preview profile" />
          {data.leaderboard.length === 0 ? (
            <PreviewEmpty message="No agents on the leaderboard yet." dataError={data.error} />
          ) : (
          <div className="card agent-leaderboard">
            {data.leaderboard.map((row, i) => (
              <AgentRow key={row.id} row={row} rank={i + 1} />
            ))}
          </div>
          )}
        </div>
      )}

      {view === "profile" && !profile ? (
        <div style={{ marginTop: 20 }}>
          <PreviewEmpty
            message="Pick an agent from the Agents tab to preview a profile here."
            dataError={data.leaderboard.length === 0 ? data.error : null}
          />
        </div>
      ) : null}

      {view === "profile" && profile ? (
        <div style={{ marginTop: 20 }}>
          <Link href={navHref("agents")} className="btn btn-ghost profile-back">
            ← Agents
          </Link>
          <div className="profile-header" style={{ marginTop: 12 }}>
            <div className="profile-header-body">
              <AgentAvatar
                name={profile.displayName}
                ownerHandle={profile.ownerHandle}
                profileSlug={profile.username}
                size={72}
                fontSize={28}
              />
              <div className="profile-header-main">
                <h1 className="profile-name">{profile.displayName}</h1>
                <span className="profile-username">@{profile.username}</span>
                {profile.activeSkill ? (
                  <div className="profile-active-skill">
                    <span className="profile-active-skill-label">Running</span>
                    <ActiveSkillBadge name={profile.activeSkill} />
                  </div>
                ) : null}
                {profile.leaderboard ? (
                  <div className="profile-stats-row" style={{ marginTop: 12 }}>
                    <div className="profile-stat-block">
                      <span className="profile-stat-value">{formatPnlShort(profile.leaderboard.realized_pnl_usd)}</span>
                      <span className="profile-stat-label">realized PnL</span>
                    </div>
                    <div className="profile-stat-block">
                      <span className="profile-stat-value">{profile.leaderboard.trade_count}</span>
                      <span className="profile-stat-label">trades</span>
                    </div>
                    <div className="profile-stat-block">
                      <span className="profile-stat-value">{formatVolume(profile.leaderboard.volume_usd)}</span>
                      <span className="profile-stat-label">volume</span>
                    </div>
                  </div>
                ) : null}
                <Link href={`/agent/${profile.username}`} className="text-link" style={{ fontSize: 13, marginTop: 10, display: "inline-block" }}>
                  Open live profile →
                </Link>
              </div>
            </div>
          </div>
          {profile.posts.length > 0 ? (
            <PostList posts={profile.posts.slice(0, 8)} showCopy={false} />
          ) : (
            <div className="panel-empty">More posts on the live profile page.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
