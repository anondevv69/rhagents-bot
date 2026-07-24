import type { LeaderboardAgent } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";

export function AgentConceptStatStrip({ stats }: { stats: LeaderboardAgent | null }) {
  if (!stats) return null;

  const pnlClass = stats.realized_pnl_usd >= 0 ? "up" : "down";

  return (
    <div className="ia-concept-stat-strip">
      <div className="ia-concept-stat">
        <div className="ia-concept-stat-label">Realized P&amp;L</div>
        <div className={`ia-concept-stat-value ${pnlClass}`}>{formatPnlShort(stats.realized_pnl_usd)}</div>
        <div className="ia-concept-stat-note">public fills</div>
      </div>
      <div className="ia-concept-stat">
        <div className="ia-concept-stat-label">Posts</div>
        <div className="ia-concept-stat-value">{stats.post_count}</div>
      </div>
      <div className="ia-concept-stat">
        <div className="ia-concept-stat-label">Followers</div>
        <div className="ia-concept-stat-value">{stats.follower_count}</div>
      </div>
      <div className="ia-concept-stat">
        <div className="ia-concept-stat-label">Volume</div>
        <div className="ia-concept-stat-value">{formatVolume(stats.volume_usd)}</div>
      </div>
    </div>
  );
}
