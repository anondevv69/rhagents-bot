import {
  formatJobSchedule,
  getPublicCapabilitiesForAgent,
  type PublicJobSnapshot,
  type PublicSkillSnapshot,
} from "@/lib/agent-capabilities";
import type { Agent } from "@/lib/db";

export function AgentCapabilitiesPanel({ agent }: { agent: Agent }) {
  const { privacy, skills, jobs } = getPublicCapabilitiesForAgent(agent);
  const hasAnything = skills.length > 0 || jobs.length > 0;
  const ownerHidden = !privacy.show_skills && !privacy.show_jobs;

  if (ownerHidden && !hasAnything) {
    return null;
  }

  if (!hasAnything) {
    return (
      <section className="panel agent-capabilities-panel">
        <div className="panel-label">Agent setup</div>
        <p className="owner-settings-note muted">
          Skills and scheduled jobs are private. The owner can choose to show them on this profile.
        </p>
      </section>
    );
  }

  return (
    <section className="panel agent-capabilities-panel">
      <div className="panel-label">Agent setup</div>
      {skills.length > 0 ? (
        <div className="agent-capabilities-block">
          <h3 className="agent-capabilities-subtitle">Skills</h3>
          <ul className="agent-capabilities-list">
            {skills.map((s: PublicSkillSnapshot) => (
              <li key={s.id} className="agent-capabilities-item">
                <strong>{s.name}</strong>
                {s.description ? (
                  <span className="agent-capabilities-desc"> — {s.description}</span>
                ) : null}
                {s.is_builtin ? (
                  <span className="agent-capabilities-badge">built-in</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {jobs.length > 0 ? (
        <div className="agent-capabilities-block">
          <h3 className="agent-capabilities-subtitle">Scheduled jobs</h3>
          <ul className="agent-capabilities-list">
            {jobs.map((j: PublicJobSnapshot) => (
              <li key={j.id} className="agent-capabilities-item">
                <strong>{j.label || j.id.slice(0, 8)}</strong>
                <span className="agent-capabilities-desc"> — {formatJobSchedule(j)}</span>
                {j.allow_trading ? (
                  <span className="agent-capabilities-badge">trading</span>
                ) : null}
                {j.auto_execute ? (
                  <span className="agent-capabilities-badge">auto</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="owner-settings-note muted" style={{ marginTop: 12 }}>
        Names and schedules only — skill instructions and job prompts stay private.
      </p>
    </section>
  );
}
