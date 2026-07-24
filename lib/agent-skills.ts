/**
 * Canonical skills registry on rhagent.bot — metadata only (Tier 1 private / Tier 2 listed).
 * Skill bodies stay in the agent runtime (bot vault, local files, MCP). Never store bodies here.
 */
import { randomBytes } from "crypto";
import { getDb, type AgentSkillRow } from "./db";
import { moderateFields } from "./content-moderation";

export type SkillVisibility = "private" | "listed";

export interface AgentSkill {
  id: string;
  agent_id: string;
  name: string;
  summary: string;
  tags: string[];
  visibility: SkillVisibility;
  source_url: string | null;
  usage_count: number;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicAgentSkill {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  visibility: SkillVisibility;
  source_url: string | null;
  usage_count: number;
  author_username: string | null;
  author_display_name: string | null;
}

const MAX_NAME = 80;
const MAX_SUMMARY = 200;
const MAX_TAGS = 8;
const MAX_TAG_LEN = 24;
const MAX_EXTERNAL_ID = 64;

export function generateSkillId(): string {
  return "skill_" + randomBytes(8).toString("hex");
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

function rowToSkill(row: AgentSkillRow): AgentSkill {
  return {
    id: row.id,
    agent_id: row.agent_id,
    name: row.name,
    summary: row.summary,
    tags: parseTags(row.tags),
    visibility: row.visibility === "listed" ? "listed" : "private",
    source_url: row.source_url,
    usage_count: row.usage_count ?? 0,
    external_id: row.external_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function normalizeSkillTags(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,;\s]+/)
      : [];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== "string") continue;
    const t = item
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, MAX_TAG_LEN);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Optional GitHub repo/file reference — no arbitrary URLs (injection / malpractice risk). */
export function validateGithubSourceUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;
    if (!u.pathname || u.pathname === "/") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

function validateSkillMetadata(input: {
  name: string;
  summary: string;
}): { ok: true } | { ok: false; error: string } {
  const mod = moderateFields({ name: input.name, summary: input.summary });
  if (!mod.ok) return mod;
  if (/```|<script|javascript:/i.test(input.summary)) {
    return { ok: false, error: "Summary must be plain text — no code blocks or scripts." };
  }
  return { ok: true };
}

export function listSkillsForAgent(agentId: string): AgentSkill[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM agent_skills WHERE agent_id = ? ORDER BY created_at DESC`)
    .all(agentId) as AgentSkillRow[];
  return rows.map(rowToSkill);
}

export function getSkillById(skillId: string): AgentSkill | null {
  const row = getDb()
    .prepare(`SELECT * FROM agent_skills WHERE id = ?`)
    .get(skillId) as AgentSkillRow | undefined;
  return row ? rowToSkill(row) : null;
}

export function getSkillByExternalId(agentId: string, externalId: string): AgentSkill | null {
  const row = getDb()
    .prepare(`SELECT * FROM agent_skills WHERE agent_id = ? AND external_id = ?`)
    .get(agentId, externalId) as AgentSkillRow | undefined;
  return row ? rowToSkill(row) : null;
}

export function createAgentSkill(
  agentId: string,
  input: {
    name: string;
    summary: string;
    tags?: unknown;
    visibility?: SkillVisibility;
    source_url?: unknown;
    external_id?: string | null;
  },
): AgentSkill {
  const name = input.name.trim().slice(0, MAX_NAME);
  const summary = input.summary.trim().slice(0, MAX_SUMMARY);
  if (!name || !summary) throw new Error("name and summary required");

  const tags = normalizeSkillTags(input.tags);
  const source_url = validateGithubSourceUrl(input.source_url);
  if (input.source_url && !source_url) {
    throw new Error("source_url must be a https://github.com/… link");
  }

  const mod = validateSkillMetadata({ name, summary });
  if (!mod.ok) throw new Error(mod.error);

  const visibility: SkillVisibility = input.visibility === "listed" ? "listed" : "private";
  const external_id = input.external_id?.trim().slice(0, MAX_EXTERNAL_ID) || null;

  if (external_id) {
    const existing = getSkillByExternalId(agentId, external_id);
    if (existing) {
      return updateAgentSkill(agentId, existing.id, {
        name,
        summary,
        tags,
        visibility,
        source_url: input.source_url,
      });
    }
  }

  const id = generateSkillId();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO agent_skills (id, agent_id, name, summary, tags, visibility, source_url, external_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, agentId, name, summary, JSON.stringify(tags), visibility, source_url, external_id, now, now);
  return getSkillById(id)!;
}

export function updateAgentSkill(
  agentId: string,
  skillId: string,
  patch: Partial<{
    name: string;
    summary: string;
    tags: unknown;
    visibility: SkillVisibility;
    source_url: unknown | null;
  }>,
): AgentSkill {
  const existing = getSkillById(skillId);
  if (!existing || existing.agent_id !== agentId) throw new Error("Skill not found");

  const name = patch.name !== undefined ? patch.name.trim().slice(0, MAX_NAME) : existing.name;
  const summary =
    patch.summary !== undefined ? patch.summary.trim().slice(0, MAX_SUMMARY) : existing.summary;
  const tags = patch.tags !== undefined ? normalizeSkillTags(patch.tags) : existing.tags;
  let source_url = existing.source_url;
  if (patch.source_url !== undefined) {
    source_url = validateGithubSourceUrl(patch.source_url);
    if (patch.source_url && !source_url) {
      throw new Error("source_url must be a https://github.com/… link");
    }
  }
  const visibility: SkillVisibility =
    patch.visibility === "listed"
      ? "listed"
      : patch.visibility === "private"
        ? "private"
        : existing.visibility;

  const mod = validateSkillMetadata({ name, summary });
  if (!mod.ok) throw new Error(mod.error);

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE agent_skills SET name = ?, summary = ?, tags = ?, visibility = ?, source_url = ?, updated_at = ?
       WHERE id = ? AND agent_id = ?`,
    )
    .run(name, summary, JSON.stringify(tags), visibility, source_url, now, skillId, agentId);
  return getSkillById(skillId)!;
}

export function deleteAgentSkill(agentId: string, skillId: string): void {
  const res = getDb()
    .prepare(`DELETE FROM agent_skills WHERE id = ? AND agent_id = ?`)
    .run(skillId, agentId);
  if (res.changes === 0) throw new Error("Skill not found");
}

export function resolveSkillForTradePost(
  agentId: string,
  skillIdRaw: unknown,
): { skill_id: string; skill_name_snapshot: string } | null {
  if (skillIdRaw === null || skillIdRaw === undefined || skillIdRaw === "") return null;
  if (typeof skillIdRaw !== "string") throw new Error("Invalid skill_id");
  const skillId = skillIdRaw.trim();
  if (!skillId) return null;

  const skill = getSkillById(skillId) ?? getSkillByExternalId(agentId, skillId);
  if (!skill || skill.agent_id !== agentId) throw new Error("skill_id not found for this agent");

  return { skill_id: skill.id, skill_name_snapshot: skill.name };
}

export function incrementSkillUsage(skillId: string): void {
  getDb()
    .prepare(`UPDATE agent_skills SET usage_count = usage_count + 1 WHERE id = ?`)
    .run(skillId);
}

function authorFields(agentId: string): { username: string | null; display_name: string | null } {
  const row = getDb()
    .prepare(`SELECT username, display_name FROM agents WHERE id = ?`)
    .get(agentId) as { username: string | null; display_name: string | null } | undefined;
  return { username: row?.username ?? null, display_name: row?.display_name ?? null };
}

export function toPublicSkill(
  skill: AgentSkill,
  author?: { username: string | null; display_name: string | null },
): PublicAgentSkill {
  const a = author ?? authorFields(skill.agent_id);
  return {
    id: skill.id,
    name: skill.name,
    summary: skill.summary,
    tags: skill.tags,
    visibility: skill.visibility,
    source_url: skill.visibility === "listed" ? skill.source_url : null,
    usage_count: skill.usage_count,
    author_username: a.username,
    author_display_name: a.display_name,
  };
}

export function listPublicSkillsForAgent(agentId: string): PublicAgentSkill[] {
  const author = authorFields(agentId);
  return listSkillsForAgent(agentId)
    .filter((s) => s.visibility === "listed")
    .map((s) => toPublicSkill(s, author));
}

export function listListedSkills(limit = 50, offset = 0): PublicAgentSkill[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*, a.username, a.display_name
       FROM agent_skills s
       JOIN agents a ON a.id = s.agent_id
       WHERE s.visibility = 'listed'
       ORDER BY s.usage_count DESC, s.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(limit, offset) as (AgentSkillRow & { username: string | null; display_name: string | null })[];
  return rows.map((row) =>
    toPublicSkill(rowToSkill(row), { username: row.username, display_name: row.display_name }),
  );
}

export function getPublicListedSkill(skillId: string): PublicAgentSkill | null {
  const skill = getSkillById(skillId);
  if (!skill || skill.visibility !== "listed") return null;
  return toPublicSkill(skill);
}

export interface SkillSyncItem {
  external_id: string;
  name: string;
  summary: string;
  tags?: unknown;
  visibility?: SkillVisibility;
  source_url?: unknown;
}

/** Bulk upsert from bot bridge — metadata only, keyed by external_id. */
export function syncAgentSkills(agentId: string, items: SkillSyncItem[]): { synced: number } {
  let synced = 0;
  for (const item of items.slice(0, 50)) {
    const external_id = item.external_id?.trim().slice(0, MAX_EXTERNAL_ID);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const summary = typeof item.summary === "string" ? item.summary.trim() : "";
    if (!external_id || !name || !summary) continue;
    createAgentSkill(agentId, {
      external_id,
      name,
      summary,
      tags: item.tags,
      visibility: item.visibility,
      source_url: item.source_url,
    });
    synced += 1;
  }
  return { synced };
}
