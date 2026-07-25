/**
 * Encrypted secrets vault — stores API keys, wallet keys, etc.
 * Uses AES-256-GCM with the MASTER_ENCRYPTION_KEY.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getDb } from "./schema.js";
import { env } from "../env.js";

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  // Pad/hash to 32 bytes
  const key = Buffer.alloc(32);
  Buffer.from(env.masterEncryptionKey).copy(key);
  return key;
}

function encrypt(plaintext: string): Buffer {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // [iv(12) | tag(16) | ciphertext]
  return Buffer.concat([iv, tag, enc]);
}

function decrypt(blob: Buffer): string {
  const key = deriveKey();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const enc = blob.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

export function getSecret(userId: string, secretKey: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM vault WHERE user_id = ? AND key = ?")
    .get(userId, secretKey) as { value: Buffer } | undefined;
  if (!row) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

export function setSecret(userId: string, secretKey: string, value: string): void {
  const blob = encrypt(value);
  getDb()
    .prepare(
      `INSERT INTO vault (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(userId, secretKey, blob);
}

export function hasSecret(userId: string, secretKey: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM vault WHERE user_id = ? AND key = ?")
    .get(userId, secretKey);
  return !!row;
}

export function deleteSecret(userId: string, secretKey: string): void {
  getDb().prepare("DELETE FROM vault WHERE user_id = ? AND key = ?").run(userId, secretKey);
}

export function clearUserVault(userId: string): void {
  getDb().prepare("DELETE FROM vault WHERE user_id = ?").run(userId);
}
