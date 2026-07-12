import { randomBytes, createHash } from "crypto";
import { getDb } from "./db";
import { ownerSessionHandle } from "./agent-identity";

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_TTL_MS = 5 * 60 * 1000;
const CONFIRM_TTL_MS = 60 * 1000;
const MAX_ACTIVE_CODES_PER_AGENT = 3;

const redeemAttempts = new Map<string, { count: number; resetAt: number }>();
const REDEEM_MAX = 8;
const REDEEM_WINDOW_MS = 10 * 60 * 1000;

function normalizeCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function formatCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function generateRawCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length];
  }
  return out;
}

function hashConfirmToken(code: string): string {
  return createHash("sha256").update(`login_confirm:${code}:${Date.now()}:${randomBytes(8).toString("hex")}`).digest("hex").slice(0, 32);
}

export function checkRedeemRateLimit(ip: string): string | null {
  const now = Date.now();
  const row = redeemAttempts.get(ip);
  if (!row || now > row.resetAt) {
    redeemAttempts.set(ip, { count: 1, resetAt: now + REDEEM_WINDOW_MS });
    return null;
  }
  row.count += 1;
  if (row.count > REDEEM_MAX) {
    return "Too many attempts — wait a few minutes and try again.";
  }
  return null;
}

export function createLoginCode(agentId: string): { code: string; expires_in: number } | { error: string } {
  const db = getDb();
  const agent = db.prepare(`
    SELECT id, claim_status, x_verified, owner_x_handle, x_handle, display_name
    FROM agents WHERE id = ?
  `).get(agentId) as {
    id: string;
    claim_status: string;
    x_verified: number;
    owner_x_handle: string | null;
    x_handle: string | null;
    display_name: string | null;
  } | undefined;

  if (!agent) return { error: "Agent not found" };
  if (agent.claim_status !== "claimed" && !agent.x_verified) {
    return { error: "Agent must be claimed before generating login codes" };
  }
  if (!ownerSessionHandle(agent)) {
    return { error: "No human owner on file — complete X claim first" };
  }

  const active = db.prepare(`
    SELECT COUNT(*) AS n FROM login_codes
    WHERE agent_id = ? AND used = 0 AND expires_at > datetime('now')
  `).get(agentId) as { n: number };
  if (active.n >= MAX_ACTIVE_CODES_PER_AGENT) {
    db.prepare(`
      UPDATE login_codes SET used = 1
      WHERE agent_id = ? AND used = 0 AND expires_at > datetime('now')
    `).run(agentId);
  }

  const raw = generateRawCode();
  const code = formatCode(raw);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  db.prepare(`
    INSERT INTO login_codes (code, agent_id, expires_at) VALUES (?, ?, ?)
  `).run(normalizeCode(code), agentId, expiresAt);

  return { code, expires_in: CODE_TTL_MS / 1000 };
}

export function previewLoginCode(inputCode: string): {
  ok: true;
  confirm_token: string;
  agent_id: string;
  agent_name: string;
  owner_handle: string;
  expires_in: number;
} | { ok: false; error: string } {
  const code = normalizeCode(inputCode);
  if (code.length !== 8) {
    return { ok: false, error: "Enter the 8-character code from your agent (e.g. 7F3K-92Q4)" };
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT lc.code, lc.agent_id, lc.expires_at, lc.used,
           a.display_name, a.owner_x_handle, a.x_handle
    FROM login_codes lc
    JOIN agents a ON a.id = lc.agent_id
    WHERE lc.code = ?
  `).get(code) as {
    code: string;
    agent_id: string;
    expires_at: string;
    used: number;
    display_name: string | null;
    owner_x_handle: string | null;
    x_handle: string | null;
  } | undefined;

  if (!row || row.used) {
    return { ok: false, error: "Invalid or already used login code" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Login code expired — ask your agent for a new one" };
  }

  const owner = ownerSessionHandle(row);
  if (!owner) {
    return { ok: false, error: "Agent has no verified human owner" };
  }

  const confirmToken = hashConfirmToken(code);
  const confirmExpires = new Date(Date.now() + CONFIRM_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO login_confirm_tokens (token, code, expires_at) VALUES (?, ?, ?)
  `).run(confirmToken, code, confirmExpires);

  return {
    ok: true,
    confirm_token: confirmToken,
    agent_id: row.agent_id,
    agent_name: row.display_name ?? row.agent_id.slice(0, 12),
    owner_handle: owner.replace(/^@/, ""),
    expires_in: CONFIRM_TTL_MS / 1000,
  };
}

export function confirmLoginCode(confirmToken: string): {
  ok: true;
  x_handle: string;
  agent_id: string;
  agent_name: string;
} | { ok: false; error: string } {
  const db = getDb();
  const confirm = db.prepare(`
    SELECT token, code, expires_at, used FROM login_confirm_tokens WHERE token = ?
  `).get(confirmToken) as { token: string; code: string; expires_at: string; used: number } | undefined;

  if (!confirm || confirm.used) {
    return { ok: false, error: "Confirmation expired — enter your login code again" };
  }
  if (new Date(confirm.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Confirmation expired — enter your login code again" };
  }

  const row = db.prepare(`
    SELECT lc.code, lc.agent_id, lc.expires_at, lc.used,
           a.display_name, a.owner_x_handle, a.x_handle
    FROM login_codes lc
    JOIN agents a ON a.id = lc.agent_id
    WHERE lc.code = ?
  `).get(confirm.code) as {
    code: string;
    agent_id: string;
    expires_at: string;
    used: number;
    display_name: string | null;
    owner_x_handle: string | null;
    x_handle: string | null;
  } | undefined;

  if (!row || row.used) {
    return { ok: false, error: "Login code no longer valid" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Login code expired" };
  }

  const owner = ownerSessionHandle(row);
  if (!owner) {
    return { ok: false, error: "Agent has no verified human owner" };
  }

  db.prepare(`UPDATE login_codes SET used = 1 WHERE code = ?`).run(confirm.code);
  db.prepare(`UPDATE login_confirm_tokens SET used = 1 WHERE token = ?`).run(confirmToken);

  return {
    ok: true,
    x_handle: owner.replace(/^@/, ""),
    agent_id: row.agent_id,
    agent_name: row.display_name ?? row.agent_id.slice(0, 12),
  };
}
