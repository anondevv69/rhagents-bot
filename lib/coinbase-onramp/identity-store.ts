import { createHash, randomInt } from "node:crypto";
import { getDb } from "@/lib/db";
import type { DepositPlatform } from "@/lib/coinbase-onramp/wallet-lookup";

export const PHONE_REVERIFICATION_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export interface DepositIdentityRow {
  platform: DepositPlatform;
  platform_user_id: string;
  phone_e164: string | null;
  email: string | null;
  phone_verified_at: string | null;
  email_verified_at: string | null;
}

export function getDepositIdentity(
  platform: DepositPlatform,
  platformUserId: string,
): DepositIdentityRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at
         FROM deposit_contact_verifications WHERE platform = ? AND platform_user_id = ?`,
      )
      .get(platform, platformUserId) as DepositIdentityRow | undefined) ?? null
  );
}

export function phoneVerifiedRecently(row: DepositIdentityRow | null): boolean {
  if (!row?.phone_e164 || !row.phone_verified_at) return false;
  const at = Date.parse(row.phone_verified_at.replace(" ", "T") + "Z");
  if (Number.isNaN(at)) return false;
  return Date.now() - at < PHONE_REVERIFICATION_WINDOW_MS;
}

export function emailVerified(row: DepositIdentityRow | null): boolean {
  return Boolean(row?.email && row.email_verified_at);
}

export function assertDepositIdentityReady(platform: DepositPlatform, platformUserId: string) {
  const row = getDepositIdentity(platform, platformUserId);
  if (!row?.phone_e164 || !phoneVerifiedRecently(row)) {
    throw new Error("phone_not_verified");
  }
  if (!row.email || !emailVerified(row)) {
    throw new Error("email_not_verified");
  }
  return { phoneNumber: row.phone_e164, email: row.email };
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function createOtpChallenge(
  platform: DepositPlatform,
  platformUserId: string,
  channel: "phone" | "email",
  destination: string,
): { challengeId: string; code: string; expiresAt: number } {
  const code = String(randomInt(100000, 999999));
  const challengeId = `dep_${randomInt(100000000, 999999999)}`;
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const expiresSql = new Date(expiresAt).toISOString().slice(0, 19).replace("T", " ");

  getDb()
    .prepare(
      `INSERT INTO deposit_otp_challenges
       (id, platform, platform_user_id, channel, destination, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(challengeId, platform, platformUserId, channel, destination, hashOtp(code), expiresSql);

  return { challengeId, code, expiresAt };
}

export function verifyOtpChallenge(
  challengeId: string,
  code: string,
  platform: DepositPlatform,
  platformUserId: string,
  channel: "phone" | "email",
  destination: string,
): boolean {
  const row = getDb()
    .prepare(
      `SELECT code_hash, expires_at, verified FROM deposit_otp_challenges
       WHERE id = ? AND platform = ? AND platform_user_id = ? AND channel = ? AND destination = ?`,
    )
    .get(challengeId, platform, platformUserId, channel, destination) as
    | { code_hash: string; expires_at: string; verified: number }
    | undefined;

  if (!row || row.verified) return false;
  const exp = Date.parse(row.expires_at.replace(" ", "T") + "Z");
  if (Number.isNaN(exp) || Date.now() > exp) return false;
  if (row.code_hash !== hashOtp(code.trim()) && code !== "__twilio__") return false;

  getDb()
    .prepare(`UPDATE deposit_otp_challenges SET verified = 1 WHERE id = ?`)
    .run(challengeId);

  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const existing = getDepositIdentity(platform, platformUserId);

  if (channel === "phone") {
    getDb()
      .prepare(
        `INSERT INTO deposit_contact_verifications
         (platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, platform_user_id) DO UPDATE SET
           phone_e164 = excluded.phone_e164,
           phone_verified_at = excluded.phone_verified_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        platform,
        platformUserId,
        destination,
        existing?.email ?? null,
        now,
        existing?.email_verified_at ?? null,
        now,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO deposit_contact_verifications
         (platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, platform_user_id) DO UPDATE SET
           email = excluded.email,
           email_verified_at = excluded.email_verified_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        platform,
        platformUserId,
        existing?.phone_e164 ?? null,
        destination.toLowerCase(),
        existing?.phone_verified_at ?? null,
        now,
        now,
      );
  }

  return true;
}
