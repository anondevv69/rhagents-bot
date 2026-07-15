/** One-time codes so an already-claimed owner can attach Telegram (or Discord later) without re-claiming. */

import { randomBytes } from "crypto";
import { getDb, type Agent } from "./db";
import { telegramDeepLink } from "./telegram";

export type OwnerLinkChannel = "telegram";

export function buildOwnerLinkCode(channel: OwnerLinkChannel = "telegram"): string {
  const prefix = channel === "telegram" ? "RHTG" : "RHLINK";
  return `${prefix}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function parseOwnerLinkCode(text: string): string | null {
  const m = text.match(/\b(RHTG-[A-F0-9]{10})\b/i);
  return m?.[1]?.toUpperCase() ?? null;
}

export function createTelegramOwnerLink(
  agentId: string,
  ttlMinutes = 30,
): { code: string; deep_link: string | null; expires_at: string } {
  const db = getDb();
  const code = buildOwnerLinkCode("telegram");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO owner_link_codes (code, agent_id, channel, expires_at)
    VALUES (?, ?, 'telegram', ?)
  `).run(code, agentId, expiresAt);
  return { code, deep_link: telegramDeepLink(code), expires_at: expiresAt };
}

export interface RedeemOwnerLinkResult {
  ok: boolean;
  error?: string;
  agent_id?: string;
  agent_name?: string;
  already?: boolean;
}

/** Attach Telegram owner to an agent via RHTG-… code from Agent Settings. */
export function redeemTelegramOwnerLink(
  code: string,
  telegramId: string,
  telegramUsername: string | null,
): RedeemOwnerLinkResult {
  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const row = db
    .prepare(
      `SELECT code, agent_id, channel, used, expires_at FROM owner_link_codes WHERE code = ?`,
    )
    .get(normalized) as
    | { code: string; agent_id: string; channel: string; used: number; expires_at: string }
    | undefined;

  if (!row || row.channel !== "telegram") {
    return { ok: false, error: "Link code not recognized. Generate a new one from Agent Settings → Link Telegram." };
  }
  if (row.used) {
    return { ok: false, error: "That link code was already used. Generate a new one from Agent Settings." };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "That link code expired. Generate a new one from Agent Settings." };
  }

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(row.agent_id) as Agent | undefined;
  if (!agent) {
    return { ok: false, error: "Agent not found for this link code." };
  }

  const claimed = agent.claim_status === "claimed" || agent.x_verified === 1;
  if (!claimed) {
    return {
      ok: false,
      error: "Agent is not claimed yet. Use /claim RHAG-XXXXXXXXXX from registration instead.",
    };
  }

  if (agent.owner_telegram_id === telegramId) {
    db.prepare(`UPDATE owner_link_codes SET used = 1 WHERE code = ?`).run(normalized);
    return { ok: true, already: true, agent_id: agent.id, agent_name: agent.display_name ?? undefined };
  }

  const other = db
    .prepare(`SELECT id FROM agents WHERE owner_telegram_id = ? AND id != ?`)
    .get(telegramId, agent.id) as { id: string } | undefined;
  if (other) {
    return {
      ok: false,
      error: "This Telegram account already manages a different rhagent. Send /unlink first if you want to switch.",
    };
  }

  if (agent.owner_telegram_id && agent.owner_telegram_id !== telegramId) {
    return {
      ok: false,
      error: "This agent is already linked to a different Telegram account. Unlink that one from Settings or /unlink first.",
    };
  }

  db.prepare(`
    UPDATE agents
    SET owner_telegram_id = ?,
        owner_telegram_username = ?,
        owner_display_name = COALESCE(owner_display_name, ?)
    WHERE id = ?
  `).run(
    telegramId,
    telegramUsername,
    telegramUsername ? `@${telegramUsername}` : null,
    agent.id,
  );
  db.prepare(`UPDATE owner_link_codes SET used = 1 WHERE code = ?`).run(normalized);

  return {
    ok: true,
    agent_id: agent.id,
    agent_name: agent.display_name ?? undefined,
  };
}
