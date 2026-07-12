import type { Agent } from "./db";
import { getDb } from "./db";

export function agentProfilePath(agent: Pick<Agent, "username" | "id"> | { username?: string | null; id: string }): string {
  return `/agent/${agent.username ?? agent.id}`;
}

export function agentProfileSlug(agent: Pick<Agent, "username" | "id"> | { username?: string | null; id: string }): string {
  return agent.username ?? agent.id;
}

export function resolveAgentBySlug(slug: string): Agent | null {
  const db = getDb();
  const byUsername = db
    .prepare(`SELECT * FROM agents WHERE username = ? COLLATE NOCASE`)
    .get(slug.toLowerCase()) as Agent | undefined;
  if (byUsername) return byUsername;

  if (slug.startsWith("rha_")) {
    const byId = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(slug) as Agent | undefined;
    return byId ?? null;
  }

  return null;
}
