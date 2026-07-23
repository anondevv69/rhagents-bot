import { getDb } from "./db";
import { moderateText } from "./content-moderation";

const MAX_NAME_LEN = 64;

export function normalizeActiveSkillName(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME_LEN);
}

export function setAgentActiveSkill(agentId: string, name: string | null): { name: string | null; updated_at: string } {
  const normalized = name === null ? null : normalizeActiveSkillName(name);
  if (name !== null && normalized === null) {
    throw new Error("Invalid skill name");
  }
  if (normalized) {
    const mod = moderateText(normalized);
    if (!mod.ok) throw new Error(mod.error ?? "Content not allowed");
  }

  const db = getDb();
  const updatedAt = new Date().toISOString();
  db.prepare(`UPDATE agents SET active_skill_name = ?, active_skill_updated_at = ? WHERE id = ?`).run(
    normalized,
    normalized ? updatedAt : null,
    agentId,
  );
  return { name: normalized, updated_at: updatedAt };
}

export function readAgentActiveSkill(agent: {
  active_skill_name?: string | null;
  active_skill_updated_at?: string | null;
}): { name: string | null; updated_at: string | null } {
  const name = agent.active_skill_name?.trim() || null;
  return { name, updated_at: name ? agent.active_skill_updated_at ?? null : null };
}

export function getActiveSkillByUsername(username: string): { name: string | null; updated_at: string | null } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT active_skill_name, active_skill_updated_at FROM agents WHERE lower(username) = lower(?)`)
    .get(username) as { active_skill_name: string | null; active_skill_updated_at: string | null } | undefined;
  if (!row) return null;
  return readAgentActiveSkill(row);
}
