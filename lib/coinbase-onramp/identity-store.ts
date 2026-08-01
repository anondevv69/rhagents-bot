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
  sms_verification_id: string | null;
  email_verification_id: string | null;
  sms_verification_expires_at: string | null;
  email_verification_expires_at: string | null;
}

function parseSqlTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const at = Date.parse(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isNaN(at) ? null : at;
}

export function getDepositIdentity(
  platform: DepositPlatform,
  platformUserId: string,
): DepositIdentityRow | null {
  return (
    (getDb()
      .prepare(
        `SELECT platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at,
                sms_verification_id, email_verification_id, sms_verification_expires_at, email_verification_expires_at
         FROM deposit_contact_verifications WHERE platform = ? AND platform_user_id = ?`,
      )
      .get(platform, platformUserId) as DepositIdentityRow | undefined) ?? null
  );
}

function verificationIdValid(expiresAt: string | null | undefined): boolean {
  const at = parseSqlTime(expiresAt ?? null);
  if (at == null) return false;
  return Date.now() < at;
}

export function phoneVerifiedRecently(row: DepositIdentityRow | null): boolean {
  if (row?.sms_verification_id && verificationIdValid(row.sms_verification_expires_at)) {
    return Boolean(row.phone_e164);
  }
  if (!row?.phone_e164 || !row.phone_verified_at) return false;
  const at = parseSqlTime(row.phone_verified_at);
  if (at == null) return false;
  return Date.now() - at < PHONE_REVERIFICATION_WINDOW_MS;
}

export function emailVerified(row: DepositIdentityRow | null): boolean {
  if (row?.email_verification_id && verificationIdValid(row.email_verification_expires_at)) {
    return Boolean(row.email);
  }
  return Boolean(row?.email && row.email_verified_at);
}

export function getDepositIdentityStatus(platform: DepositPlatform, platformUserId: string) {
  const row = getDepositIdentity(platform, platformUserId);
  return {
    phone: row?.phone_e164 ?? null,
    email: row?.email ?? null,
    phone_verified: phoneVerifiedRecently(row),
    email_verified: emailVerified(row),
    ready: phoneVerifiedRecently(row) && emailVerified(row),
  };
}

export function assertDepositIdentityReady(platform: DepositPlatform, platformUserId: string) {
  const row = getDepositIdentity(platform, platformUserId);
  if (!row?.phone_e164 || !phoneVerifiedRecently(row)) {
    throw new Error("phone_not_verified");
  }
  if (!row.email || !emailVerified(row)) {
    throw new Error("email_not_verified");
  }
  return {
    phoneNumber: row.phone_e164,
    email: row.email,
    smsVerificationId: row.sms_verification_id ?? undefined,
    emailVerificationId: row.email_verification_id ?? undefined,
    phoneNumberVerifiedAt: row.phone_verified_at ?? undefined,
  };
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Pending Coinbase verification — id is Coinbase verificationId. */
export function createPendingCoinbaseVerification(params: {
  verificationId: string;
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
  expiresAtIso: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO deposit_otp_challenges
       (id, platform, platform_user_id, channel, destination, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         destination = excluded.destination,
         expires_at = excluded.expires_at,
         verified = 0`,
    )
    .run(
      params.verificationId,
      params.platform,
      params.platformUserId,
      params.channel,
      params.destination,
      "__coinbase__",
      params.expiresAtIso.slice(0, 19).replace("T", " "),
    );
}

export function getPendingCoinbaseVerification(
  verificationId: string,
  platform: DepositPlatform,
  platformUserId: string,
  channel: "phone" | "email",
  destination: string,
): { expires_at: string } | null {
  const row = getDb()
    .prepare(
      `SELECT expires_at, verified FROM deposit_otp_challenges
       WHERE id = ? AND platform = ? AND platform_user_id = ? AND channel = ? AND destination = ?`,
    )
    .get(verificationId, platform, platformUserId, channel, destination) as
    | { expires_at: string; verified: number }
    | undefined;
  if (!row || row.verified) return null;
  return { expires_at: row.expires_at };
}

export function markPendingVerificationComplete(verificationId: string): void {
  getDb()
    .prepare(`UPDATE deposit_otp_challenges SET verified = 1 WHERE id = ?`)
    .run(verificationId);
}

export function saveCoinbaseVerification(params: {
  platform: DepositPlatform;
  platformUserId: string;
  channel: "phone" | "email";
  destination: string;
  verificationId: string;
  verificationExpiresAt: string;
}): void {
  markPendingVerificationComplete(params.verificationId);
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const expiresSql = params.verificationExpiresAt.slice(0, 19).replace("T", " ");
  const existing = getDepositIdentity(params.platform, params.platformUserId);

  if (params.channel === "phone") {
    getDb()
      .prepare(
        `INSERT INTO deposit_contact_verifications
         (platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at,
          sms_verification_id, email_verification_id, sms_verification_expires_at, email_verification_expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, platform_user_id) DO UPDATE SET
           phone_e164 = excluded.phone_e164,
           phone_verified_at = excluded.phone_verified_at,
           sms_verification_id = excluded.sms_verification_id,
           sms_verification_expires_at = excluded.sms_verification_expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        params.platform,
        params.platformUserId,
        params.destination,
        existing?.email ?? null,
        now,
        existing?.email_verified_at ?? null,
        params.verificationId,
        existing?.email_verification_id ?? null,
        expiresSql,
        existing?.email_verification_expires_at ?? null,
        now,
      );
  } else {
    getDb()
      .prepare(
        `INSERT INTO deposit_contact_verifications
         (platform, platform_user_id, phone_e164, email, phone_verified_at, email_verified_at,
          sms_verification_id, email_verification_id, sms_verification_expires_at, email_verification_expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, platform_user_id) DO UPDATE SET
           email = excluded.email,
           email_verified_at = excluded.email_verified_at,
           email_verification_id = excluded.email_verification_id,
           email_verification_expires_at = excluded.email_verification_expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        params.platform,
        params.platformUserId,
        existing?.phone_e164 ?? null,
        params.destination.toLowerCase(),
        existing?.phone_verified_at ?? null,
        now,
        existing?.sms_verification_id ?? null,
        params.verificationId,
        existing?.sms_verification_expires_at ?? null,
        expiresSql,
        now,
      );
  }
}

/** Local dev fallback when CDP verification API unavailable. */
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
  const exp = parseSqlTime(row.expires_at);
  if (exp == null || Date.now() > exp) return false;
  if (row.code_hash !== hashOtp(code.trim())) return false;

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
