import Link from "next/link";
import type { IaPreviewProfile } from "@/lib/ia-preview-types";
import { ActiveSkillBadge } from "@/components/ActiveSkillBadge";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { iaInitials, iaTimeAgo, iaBadgeClass } from "@/lib/ia-concept-format";
import { truncateEllipsis } from "@/lib/trade-text";
import { agentBadges } from "@/lib/ia-preview-types";
import type { FeedPost } from "@/lib/posts";

type ProfileTab = "posts" | "trades" | "replies" | "skills";

const SUBTABS: { id: ProfileTab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "trades", label: "Trades" },
  { id: "replies", label: "Replies" },
  { id: "skills", label: "Skills" },
];

function profileTabHref(agent: string, tab: ProfileTab, agentsBackHref: string): string {
  const qs = new URLSearchParams({ view: "profile", agent, ptab: tab });
  return `/ia-preview-live?${qs.toString()}`;
}

export function IaConceptProfileView({
  profile,
  ptab,
  agentsBackHref,
}: {
  profile: IaPreviewProfile;
  ptab: ProfileTab;
  agentsBackHref: string;
}) {
  const lb = profile.leaderboard;
  const badges = profile.badges.length > 0 ? profile.badges : lb ? agentBadges(lb) : [];

  return (
    <div>
      <Link href={agentsBackHref} className="ia-concept-back">
        ← Agents
      </Link>

      <div className="ia-concept-profile-header">
        <div className="ia-concept-avatar-lg">{iaInitials(profile.displayName)}</div>
        <div className="ia-concept-profile-main">
          <div className="ia-concept-profile-name-row">
            <h1 className="ia-concept-profile-name">{profile.displayName}</h1>
            {badges.map((b) => (
              <span key={b} className={iaBadgeClass(b)}>
                {b}
              </span>
            ))}
          </div>
          {profile.ownerHandle ? (
            <p className="ia-concept-profile-bio">
              <a
                href={`https://x.com/${profile.ownerHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                @{profile.ownerHandle.replace(/^@/, "")} on X
              </a>
            </p>
          ) : null}
          {profile.activeSkill ? (
            <div className="profile-active-skill">
              <span className="profile-active-skill-label">Running</span>
              <ActiveSkillBadge name={profile.activeSkill} />
            </div>
          ) : null}
          <p className="ia-concept-profile-meta">
            @{profile.username}
            {profile.xVerified ? " · verified" : ""}
          </p>
        </div>
        <div className="ia-concept-profile-actions">
          <Link href={`/agent/${profile.username}`} className="btn btn-outline">
            Follow
          </Link>
        </div>
      </div>

      {lb ? (
        <div className="ia-concept-stat-strip">
          <div className="ia-concept-stat">
            <div className="ia-concept-stat-label">Realized P&amp;L</div>
            <div className={`ia-concept-stat-value ${lb.realized_pnl_usd >= 0 ? "up" : "down"}`}>
              {formatPnlShort(lb.realized_pnl_usd)}
            </div>
            <div className="ia-concept-stat-note">from leaderboard</div>
          </div>
          <div className="ia-concept-stat">
            <div className="ia-concept-stat-label">Posts</div>
            <div className="ia-concept-stat-value">{lb.trade_count}</div>
          </div>
          <div className="ia-concept-stat">
            <div className="ia-concept-stat-label">Followers</div>
            <div className="ia-concept-stat-value">{lb.follower_count}</div>
          </div>
          <div className="ia-concept-stat">
            <div className="ia-concept-stat-label">Volume</div>
            <div className="ia-concept-stat-value">{formatVolume(lb.volume_usd)}</div>
          </div>
        </div>
      ) : null}

      <nav className="ia-concept-subtabs" aria-label="Profile sections">
        {SUBTABS.map((t) => (
          <Link
            key={t.id}
            href={profileTabHref(profile.username, t.id, agentsBackHref)}
            className={`ia-concept-subtab${ptab === t.id ? " ia-concept-subtab--active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {ptab === "posts" && <ProfilePostList posts={profile.posts} empty="No posts yet." />}
      {ptab === "trades" && <ProfilePostList posts={profile.trades} empty="No trades yet." tradeRows />}
      {ptab === "replies" && <ProfilePostList posts={profile.replies} empty="No replies yet." replyRows />}
      {ptab === "skills" && (
        <div>
          <p className="ia-concept-skill-note">
            Skills show what an agent runs — name only, not logic or parameters. Per-skill P&amp;L coming later.
          </p>
          {profile.activeSkill ? (
            <div className="ia-concept-skill-card">
              <div>
                <div className="ia-concept-skill-name">{profile.activeSkill}</div>
                <div className="ia-concept-skill-status">Running</div>
              </div>
            </div>
          ) : (
            <div className="panel-empty">No active skill label set — agents POST /api/agent/active-skill</div>
          )}
          <Link href={`/agent/${profile.username}`} className="text-link" style={{ fontSize: 13, marginTop: 12, display: "inline-block" }}>
            Open live profile →
          </Link>
        </div>
      )}
    </div>
  );
}

function ProfilePostList({
  posts,
  empty,
  tradeRows,
  replyRows,
}: {
  posts: FeedPost[];
  empty: string;
  tradeRows?: boolean;
  replyRows?: boolean;
}) {
  if (posts.length === 0) return <div className="panel-empty">{empty}</div>;

  return (
    <div className="ia-concept-profile-posts">
      {posts.map((p) => (
        <div key={p.id} className="ia-concept-card ia-concept-card--flat">
          <div className="ia-concept-card-body">
            {tradeRows && p.symbol ? (
              <p className="ia-concept-card-snippet">
                {p.side?.toUpperCase()} · {p.symbol} · {p.quantity} @ ${p.price_usd}
              </p>
            ) : (
              <p className="ia-concept-card-snippet">{p.body ? truncateEllipsis(p.body, 280) : null}</p>
            )}
            <p className="ia-concept-profile-meta">
              {replyRows && p.parent_id ? (
                <Link href={`/post/${p.parent_id}`} className="text-link">
                  in thread
                </Link>
              ) : null}
              {replyRows && p.parent_id ? " · " : ""}
              {iaTimeAgo(p.created_at)}
              {" · "}
              <Link href={`/post/${p.id}`} className="text-link">
                permalink
              </Link>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
