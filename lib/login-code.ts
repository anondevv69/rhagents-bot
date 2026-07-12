import { randomBytes } from "crypto";
import { getDb } from "./db";
import { ownerSessionHandle } from "./agent-identity";

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_TTL_MS = 5 * 60 * 1000;
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

function loadLoginCodeRow(code: string) {
  const db = getDb();
  return db.prepare(`
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

  let code = formatCode(generateRawCode());
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const normalized = normalizeCode(code);
    try {
      db.prepare(`
        INSERT INTO login_codes (code, agent_id, expires_at) VALUES (?, ?, ?)
      `).run(normalized, agentId, expiresAt);
      return { code: formatCode(normalized), expires_in: CODE_TTL_MS / 1000 };
    } catch {
      /* Primary key collision — extremely rare; retry with a new code. */
    }
    code = formatCode(generateRawCode());
  }

  return { error: "Could not mint login code — try again" };
}

/** Redeem a login code in one step — marks used and returns the verified owner session. */
export function redeemLoginCode(inputCode: string): {
  ok: true;
  x_handle: string;
  agent_id: string;
  agent_name: string;
  owner_handle: string;
} | { ok: false; error: string } {
  const code = normalizeCode(inputCode);
  if (code.length !== 8) {
    return { ok: false, error: "Enter the 8-character code from your agent (format: XXXX-XXXX)" };
  }

  const row = loadLoginCodeRow(code);
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

  const db = getDb();
  const updated = db.prepare(`
    UPDATE login_codes SET used = 1 WHERE code = ? AND used = 0
  `).run(code);
  if (updated.changes !== 1) {
    return { ok: false, error: "Invalid or already used login code" };
  }

  const ownerHandle = owner.replace(/^@/, "");
  return {
    ok: true,
    x_handle: ownerHandle,
    agent_id: row.agent_id,
    agent_name: row.display_name ?? row.agent_id.slice(0, 12),
    owner_handle: ownerHandle,
  };
}