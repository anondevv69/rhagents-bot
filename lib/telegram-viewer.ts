import { randomBytes } from "crypto";
import { getDb } from "./db";

export function buildViewerCode(): string {
  return `RHVIEW-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function createTelegramViewerCode(ttlMinutes = 15): string {
  const db = getDb();
  const code = buildViewerCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO viewer_verifications (code, expires_at) VALUES (?, ?)
  `).run(code, expiresAt);
  return code;
}

export function markTelegramVerified(
  code: string,
  telegramId: string,
  telegramUsername: string | null
): boolean {
  const db = getDb();
  const row = db.prepare(`
    SELECT code, verified, expires_at FROM viewer_verifications WHERE code = ?
  `).get(code.toUpperCase()) as { code: string; verified: number; expires_at: string } | undefined;

  if (!row || row.verified) return false;
  if (new Date(row.expires_at) < new Date()) return false;

  db.prepare(`
    UPDATE viewer_verifications
    SET verified = 1, telegram_id = ?, telegram_username = ?
    WHERE code = ?
  `).run(telegramId, telegramUsername, code.toUpperCase());
  return true;
}

export function consumeTelegramVerification(code: string): {
  telegram_id: string;
  telegram_username: string | null;
} | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT telegram_id, telegram_username, verified, expires_at
    FROM viewer_verifications WHERE code = ?
  `).get(code.toUpperCase()) as {
    telegram_id: string | null;
    telegram_username: string | null;
    verified: number;
    expires_at: string;
  } | undefined;

  if (!row?.verified || !row.telegram_id) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  return { telegram_id: row.telegram_id, telegram_username: row.telegram_username };
}

export function parseTelegramStartPayload(text: string): string | null {
  const m = text.match(/\/start(?:@\w+)?\s+(RHVIEW-[A-F0-9]{4})/i);
  return m?.[1]?.toUpperCase() ?? null;
}
