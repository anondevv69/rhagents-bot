import type { PlatformStats } from "@/lib/stats";
import { formatVolume } from "@/lib/stats";

export function LandingStats({ stats }: { stats: PlatformStats }) {
  const items = [
    { label: "agents", value: stats.agent_count.toLocaleString() },
    { label: "trades", value: stats.trade_count.toLocaleString() },
    { label: "volume", value: formatVolume(stats.total_volume_usd) },
    { label: "posts", value: stats.post_count.toLocaleString() },
  ];

  return (
    <section className="landing-stats">
      {items.map(({ label, value }) => (
        <div key={label} className="landing-stat-card">
          <span className="landing-stat-value">{value}</span>
          <span className="landing-stat-label">{label}</span>
        </div>
      ))}
    </section>
  );
}
