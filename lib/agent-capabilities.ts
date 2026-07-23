/**
 * Public-safe snapshot of an agent's skills + scheduled jobs for rhagent.bot profiles.
 * Never stores skill bodies or job prompts — names, schedules, and flags only.
 */
import { getDb, type Agent } from "./db";

export interface PublicSkillSnapshot {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  is_builtin: boolean;
}

export interface PublicJobSnapshot {
  id: string;
  label: string | null;
  schedule_kind: "daily_utc" | "interval_minutes";
  at_utc_hhmm: string | null;
  interval_minutes: number | null;
  allow_trading: boolean;
  auto_execute: boolean;
  active: boolean;
}

export interface AgentCapabilitiesSnapshot {
  skills: PublicSkillSnapshot[];
  jobs: PublicJobSnapshot[];
  synced_at: string;
}

export interface AgentProfilePrivacy {
  show_skills: boolean;
  show_jobs: boolean;
}

export function defaultProfilePrivacy(): AgentProfilePrivacy {
  return { show_skills: false, show_jobs: false };
}

export function readProfilePrivacy(agent: Pick<Agent, "profile_show_skills" | "profile_show_jobs">): AgentProfilePrivacy {
  return {
    show_skills: !!agent.profile_show_skills,
    show_jobs: !!agent.profile_show_jobs,
  };
}

export function parseCapabilitiesSnapshot(raw: string | null | undefined): AgentCapabilitiesSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as AgentCapabilitiesSnapshot;
    if (!data || typeof data !== "object" || !Array.isArray(data.skills) || !Array.isArray(data.jobs)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Sanitize inbound sync payload — strip anything that isn't public-safe. */
export function sanitizeCapabilitiesInput(body: unknown): AgentCapabilitiesSnapshot | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const skillsRaw = Array.isArray(o.skills) ? o.skills : [];
  const jobsRaw = Array.isArray(o.jobs) ? o.jobs : [];

  const skills: PublicSkillSnapshot[] = [];
  for (const item of skillsRaw.slice(0, 50)) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const id = typeof s.id === "string" ? s.id.trim().slice(0, 64) : "";
    const name = typeof s.name === "string" ? s.name.trim().slice(0, 80) : "";
    if (!id || !name) continue;
    skills.push({
      id,
      name,
      description: typeof s.description === "string" ? s.description.trim().slice(0, 200) : null,
      enabled: s.enabled !== false,
      is_builtin: !!s.is_builtin,
    });
  }

  const jobs: PublicJobSnapshot[] = [];
  for (const item of jobsRaw.slice(0, 20)) {
    if (!item || typeof item !== "object") continue;
    const j = item as Record<string, unknown>;
    const id = typeof j.id === "string" ? j.id.trim().slice(0, 64) : "";
    if (!id) continue;
    const scheduleKind = j.schedule_kind === "interval_minutes" ? "interval_minutes" : "daily_utc";
    jobs.push({
      id,
      label: typeof j.label === "string" ? j.label.trim().slice(0, 80) : null,
      schedule_kind: scheduleKind,
      at_utc_hhmm: typeof j.at_utc_hhmm === "string" ? j.at_utc_hhmm.slice(0, 5) : null,
      interval_minutes:
        typeof j.interval_minutes === "number" && Number.isFinite(j.interval_minutes)
          ? Math.max(5, Math.min(10_080, Math.floor(j.interval_minutes)))
          : null,
      allow_trading: !!j.allow_trading,
      auto_execute: !!j.auto_execute,
      active: j.active !== false,
    });
  }

  return {
    skills,
    jobs,
    synced_at: new Date().toISOString(),
  };
}

export function saveAgentCapabilitiesSnapshot(agentId: string, snapshot: AgentCapabilitiesSnapshot): void {
  const db = getDb();
  db.prepare(
    `UPDATE agents SET agent_capabilities_snapshot = ?, agent_capabilities_synced_at = ? WHERE id = ?`,
  ).run(JSON.stringify(snapshot), snapshot.synced_at, agentId);
}

export function updateAgentProfilePrivacy(
  agentId: string,
  patch: Partial<AgentProfilePrivacy>,
): AgentProfilePrivacy {
  const db = getDb();
  const row = db
    .prepare(`SELECT profile_show_skills, profile_show_jobs FROM agents WHERE id = ?`)
    .get(agentId) as { profile_show_skills: number; profile_show_jobs: number } | undefined;
  if (!row) throw new Error("agent_not_found");

  const next: AgentProfilePrivacy = {
    show_skills: patch.show_skills ?? !!row.profile_show_skills,
    show_jobs: patch.show_jobs ?? !!row.profile_show_jobs,
  };
  db.prepare(`UPDATE agents SET profile_show_skills = ?, profile_show_jobs = ? WHERE id = ?`).run(
    next.show_skills ? 1 : 0,
    next.show_jobs ? 1 : 0,
    agentId,
  );
  return next;
}

export function getPublicCapabilitiesForAgent(
  agent: Pick<
    Agent,
    "agent_capabilities_snapshot" | "profile_show_skills" | "profile_show_jobs"
  >,
): { privacy: AgentProfilePrivacy; skills: PublicSkillSnapshot[]; jobs: PublicJobSnapshot[] } {
  const privacy = readProfilePrivacy(agent);
  const snapshot = parseCapabilitiesSnapshot(agent.agent_capabilities_snapshot);
  if (!snapshot) {
    return { privacy, skills: [], jobs: [] };
  }
  return {
    privacy,
    skills: privacy.show_skills ? snapshot.skills.filter((s) => s.enabled) : [],
    jobs: privacy.show_jobs ? snapshot.jobs.filter((j) => j.active) : [],
  };
}

export function formatJobSchedule(job: PublicJobSnapshot): string {
  if (job.schedule_kind === "interval_minutes" && job.interval_minutes) {
    return `every ${job.interval_minutes} min`;
  }
  return `daily ${job.at_utc_hhmm ?? "??:??"} UTC`;
}
