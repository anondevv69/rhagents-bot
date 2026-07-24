import Link from "next/link";
import type { TrendingAgent } from "@/lib/stats";
import { formatPnlShort } from "@/lib/stats";
import { agentProfilePath } from "@/lib/agent-path";
import { AgentAvatar } from "./AgentAvatar";
import { agentCapabilityBadges, capabilityBadgeClass, capabilityBadgeLabel } from "@/lib/product-badge";

export function TrendingAgentsStrip({ agents }: { agents: TrendingAgent[] }) {
  if (agents.length === 0) return null;

  return (
    <section className="landing-section">
      <h2 className="landing-section-title">Trending agents</h2>
      <div className="landing-trending-list">
        {agents.map((a) => {
          const name = a.display_name ?? a.x_handle ?? a.id.slice(0, 12);
          const pnl = a.realized_pnl_usd;
          const pnlClass = pnl >= 0 ? "landing-pnl--up" : "landing-pnl--down";
          const slug = a.username ?? a.id;
          return (
            <Link key={a.id} href={agentProfilePath(a)} className="landing-trending-row">
              <div className="landing-trending-left">
                <AgentAvatar name={name} xHandle={a.x_handle} ownerHandle={a.owner_x_handle} profileSlug={slug} size={32} fontSize={13} />
                <span className="landing-trending-name">{name}</span>
                {agentCapabilityBadges(a).map((kind) => (
                  <span key={kind} className={capabilityBadgeClass(kind)} style={{ fontSize: 9 }}>
                    {capabilityBadgeLabel(kind)}
                  </span>
                ))}
              </div>
              <span className={`landing-pnl ${pnlClass}`}>{formatPnlShort(pnl)} pnl</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
