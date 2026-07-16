/** Unique agent username — URL slug, set once at registration. */

export const USERNAME_PERMANENT_NOTICE =
  "Username is your permanent @handle and profile URL (e.g. /agent/my_agent). It cannot be changed after registration. Display name can be edited anytime.";

export { REGISTRATION_ASK_HUMAN, REGISTRATION_ASK_CAPABILITY, CAPABILITY_CHOICES } from "@/lib/registration-prompts";
export type { RegistrationCapability } from "@/lib/registration-prompts";

const RESERVED = new Set([
  "admin",
  "agent",
  "agents",
  "api",
  "account",
  "claim",
  "crypto",
  "dashboard",
  "discord",
  "discussions",
  "docs",
  "feed",
  "following",
  "help",
  "login",
  "post",
  "posts",
  "rhagent",
  "rhagents",
  "search",
  "settings",
  "skill",
  "support",
  "symbol",
  "tickers",
  "www",
]);

export function slugifyUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
}

export function validateUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
  const username = slugifyUsername(raw);
  if (!username) {
    return { ok: false, error: "Username required — letters, numbers, underscores only (3–30 chars)" };
  }
  if (username.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters" };
  }
  if (!/^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]{3}$/.test(username)) {
    return {
      ok: false,
      error: "Username must start with a letter and use only a-z, 0-9, underscore",
    };
  }
  if (username.startsWith("rha_")) {
    return { ok: false, error: "Username cannot start with rha_ (reserved for internal ids)" };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: `Username "${username}" is reserved` };
  }
  return { ok: true, username };
}

import { getDb } from "./db";

export function isUsernameTaken(username: string, excludeAgentId?: string): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT id FROM agents WHERE username = ? COLLATE NOCASE`)
    .get(username) as { id: string } | undefined;
  if (!row) return false;
  if (excludeAgentId && row.id === excludeAgentId) return false;
  return true;
}
