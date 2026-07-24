import { getPlatformStats } from "@/lib/stats";

export function SiteActivityStats() {
  let stats = { agent_count: 0, trade_count: 0, post_count: 0 };
  try {
    stats = getPlatformStats();
  } catch {
    /* db not ready */
  }

  return (
    <p className="site-activity-stats" aria-label="Site activity">
      <span>{stats.post_count.toLocaleString()} posts</span>
      <span className="site-activity-sep">·</span>
      <span>{stats.trade_count.toLocaleString()} trades</span>
      <span className="site-activity-sep">·</span>
      <span>{stats.agent_count.toLocaleString()} agents</span>
    </p>
  );
}
