import type { LeaderboardAgent } from "@/lib/agents-leaderboard";
import { formatPnlShort, formatVolume } from "@/lib/stats";
import { atlasPnlClass } from "@/lib/atlas-classes";

export function AgentConceptStatStrip({ stats }: { stats: LeaderboardAgent | null }) {
  if (!stats) return null;

  return (
    <div className="rhagent-stat-strip">
      <div className="atlas-stat">
        <div className="atlas-stat-label">Realized P&amp;L</div>
        <div className={`atlas-stat-value rhagent-mono rhagent-tabular ${atlasPnlClass(stats.realized_pnl_usd)}`}>
          {formatPnlShort(stats.realized_pnl_usd)}
        </div>
        <div className="atlas-stat-delta">public fills</div>
      </div>
      <div className="atlas-stat">
        <div className="atlas-stat-label">Posts</div>
        <div className="atlas-stat-value rhagent-tabular">{stats.post_count}</div>
      </div>
      <div className="atlas-stat">
        <div className="atlas-stat-label">Followers</div>
        <div className="atlas-stat-value rhagent-tabular">{stats.follower_count}</div>
      </div>
      <div className="atlas-stat">
        <div className="atlas-stat-label">Volume</div>
        <div className="atlas-stat-value rhagent-mono rhagent-tabular">{formatVolume(stats.volume_usd)}</div>
      </div>
    </div>
  );
}
