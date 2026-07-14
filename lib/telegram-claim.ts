/** Telegram-native claim — alternative to the X tweet-claim flow (no X account required). */
import { getDb, type Agent } from "./db";

/** buildVerificationCode() in lib/claim.ts emits RHAG- + 10 hex chars. */
const CLAIM_CODE_RE = /(RHAG-[A-F0-9]{10})/i;

export function parseClaimCodeFromText(text: string): string | null {
  const m = text.match(CLAIM_CODE_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

export interface TelegramClaimResult {
  ok: boolean;
  error?: string;
  agent_id?: string;
  agent_name?: string;
  already?: boolean;
}

/**
 * Claim (or later, re-link) agent ownership using a Telegram identity instead of a tweet.
 * Mirrors the success path of POST /api/claim/verify — same NFT mint + claim_status transition.
 */
export function verifyTelegramClaim(
  code: string,
  telegramId: string,
  telegramUsername: string | null,
): TelegramClaimResult {
  const db = getDb();
  const normalized = code.trim().toUpperCase();

  const claim = db.prepare("SELECT * FROM claims WHERE code = ?").get(normalized) as
    | { code: string; agent_id: string; verified: number; channel: string; telegram_id: string | null }
    | undefined;

  if (!claim) {
    return { ok: false, error: "Claim code not recognized. Double-check the RHAG-… code your agent sent you." };
  }

  const existingOwnerAgent = db
    .prepare("SELECT id, display_name FROM agents WHERE owner_telegram_id = ?")
    .get(telegramId) as { id: string; display_name: string | null } | undefined;

  if (claim.verified) {
    if (claim.channel === "telegram" && claim.telegram_id === telegramId) {
      return { ok: true, already: true, agent_id: claim.agent_id };
    }
    return { ok: false, error: "This agent is already claimed by a different owner." };
  }

  if (existingOwnerAgent && existingOwnerAgent.id !== claim.agent_id) {
    return {
      ok: false,
      error: "This Telegram account already manages a different rhagent. Send /unlink first if you want to switch.",
    };
  }

  db.prepare(`
    UPDATE claims SET verified = 1, channel = 'telegram', telegram_id = ?, telegram_username = ? WHERE code = ?
  `).run(telegramId, telegramUsername, normalized);

  db.prepare(`
    UPDATE agents
    SET owner_telegram_id = ?,
        owner_telegram_username = ?,
        owner_display_name = COALESCE(owner_display_name, ?),
        claim_status = 'claimed'
    WHERE id = ?
  `).run(telegramId, telegramUsername, telegramUsername ? `@${telegramUsername}` : null, claim.agent_id);

  try {
    // Mint identity NFT + anchor on Robinhood Chain — async, never blocks the claim.
    void import("@/lib/inscriber").then(({ scheduleInscribeAgent }) => {
      const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(claim.agent_id) as Agent | undefined;
      if (agent) scheduleInscribeAgent(agent);
    });
  } catch (err) {
    console.error("[telegram-claim] schedule NFT mint failed", err);
  }

  const agent = db.prepare("SELECT display_name FROM agents WHERE id = ?").get(claim.agent_id) as
    | { display_name: string | null }
    | undefined;

  return { ok: true, agent_id: claim.agent_id, agent_name: agent?.display_name ?? undefined };
}

export function findAgentByTelegramOwner(telegramId: string): Agent | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM agents WHERE owner_telegram_id = ?").get(telegramId) as Agent | undefined) ?? null
  );
}

/** Removes management access for this Telegram account — claim history + posts are untouched. */
export function unlinkTelegramOwner(telegramId: string): boolean {
  const db = getDb();
  const res = db
    .prepare("UPDATE agents SET owner_telegram_id = NULL, owner_telegram_username = NULL WHERE owner_telegram_id = ?")
    .run(telegramId);
  return res.changes > 0;
}
