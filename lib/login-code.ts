import { randomBytes } from "crypto";
import { getDb } from "./db";
import { ownerSessionHandle } from "./agent-identity";

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_TTL_MS = 5 * 60 * 1000;

const redeemAttempts = new Map<string, { count: number; resetAt: number }>();
const REDEEM_MAX = 20;
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

/** expires_at stored as unix ms string for reliable SQLite comparisons. */
function parseExpiresAt(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
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

export function isRateLimited(ip: string): boolean {
  const row = redeemAttempts.get(ip);
  if (!row || Date.now() > row.resetAt) return false;
  return row.count > REDEEM_MAX;
}

/** Count a failed redeem attempt toward the rate limit. */
export function noteRedeemFailure(ip: string): void {
  const now = Date.now();
  const row = redeemAttempts.get(ip);
  if (!row || now > row.resetAt) {
    redeemAttempts.set(ip, { count: 1, resetAt: now + REDEEM_WINDOW_MS });
    return;
  }
  row.count += 1;
}

/** @deprecated use isRateLimited + noteRedeemFailure */
export function checkRedeemRateLimit(ip: string): string | null {
  return isRateLimited(ip) ? "Too many attempts — wait a few minutes, then ask your agent for a fresh code." : null;
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

  // Only the latest minted code is valid — invalidate older unused codes.
  db.prepare(`
    UPDATE login_codes SET used = 1 WHERE agent_id = ? AND used = 0
  `).run(agentId);

  const expiresAtMs = Date.now() + CODE_TTL_MS;
  const expiresAt = String(expiresAtMs);

  let code = formatCode(generateRawCode());
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const normalized = normalizeCode(code);
    try {
      db.prepare(`
        INSERT INTO login_codes (code, agent_id, expires_at) VALUES (?, ?, ?)
      `).run(normalized, agentId, expiresAt);
      return { code: formatCode(normalized), expires_in: CODE_TTL_MS / 1000 };
    } catch {
      /* Primary key collision — retry. */
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
  if (!row) {
    return {
      ok: false,
      error:
        "Code not recognized. Your agent must call POST /api/agent/login-code with RHAGENTS_AGENT_KEY and send you the exact code from the JSON response — not a made-up code.",
    };
  }
  const expired = parseExpiresAt(row.expires_at) < Date.now();
  if (expired) {
    return { ok: false, error: "Login code expired — ask your agent for a new one" };
  }

  const owner = ownerSessionHandle(row);
  if (!owner) {
    return { ok: false, error: "Agent has no verified human owner — finish X claim first" };
  }

  // Mark used on first successful redeem; allow re-redeem until expiry if cookie didn't stick.
  if (!row.used) {
    const db = getDb();
    db.prepare(`UPDATE login_codes SET used = 1 WHERE code = ? AND used = 0`).run(code);
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
