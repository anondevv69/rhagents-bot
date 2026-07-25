/**
 * User CRUD — single entry point for user management.
 */
import { randomUUID } from "crypto";
import { getDb } from "./schema.js";
import type { Platform, OnboardingStep, User } from "@rhagent/shared";

export function findUser(platform: Platform, platformId: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE platform = ? AND platform_id = ?")
    .get(platform, platformId) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function getUser(id: string): User | null {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToUser(row) : null;
}

export function findOrCreateUser(
  platform: Platform,
  platformId: string,
  opts: { username?: string; displayName?: string } = {},
): User {
  const existing = findUser(platform, platformId);
  if (existing) {
    // Update display info if changed
    if (opts.username || opts.displayName) {
      getDb()
        .prepare(
          `UPDATE users SET username = COALESCE(?, username), display_name = COALESCE(?, display_name),
           updated_at = datetime('now') WHERE id = ?`,
        )
        .run(opts.username ?? null, opts.displayName ?? null, existing.id);
    }
    return { ...existing, ...opts };
  }

  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO users (id, platform, platform_id, username, display_name) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, platform, platformId, opts.username ?? null, opts.displayName ?? null);
  return {
    id,
    platform,
    platformId,
    username: opts.username,
    displayName: opts.displayName,
    tier: "free",
    createdAt: new Date().toISOString(),
    onboardingStep: "welcome",
  };
}

export function updateOnboardingStep(userId: string, step: OnboardingStep): void {
  getDb()
    .prepare("UPDATE users SET onboarding_step = ?, updated_at = datetime('now') WHERE id = ?")
    .run(step, userId);
}

export function updateWallet(userId: string, address: string, walletId: string): void {
  getDb()
    .prepare(
      "UPDATE users SET wallet_address = ?, wallet_id = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(address, walletId, userId);
}

export function getManagedMessagesUsed(userId: string): number {
  const row = getDb()
    .prepare("SELECT managed_messages_used FROM users WHERE id = ?")
    .get(userId) as { managed_messages_used: number } | undefined;
  return row?.managed_messages_used ?? 0;
}

export function consumeManagedMessage(userId: string): number {
  getDb()
    .prepare(
      "UPDATE users SET managed_messages_used = managed_messages_used + 1, updated_at = datetime('now') WHERE id = ?",
    )
    .run(userId);
  return getManagedMessagesUsed(userId);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    platform: row.platform as Platform,
    platformId: row.platform_id as string,
    username: row.username as string | undefined,
    displayName: row.display_name as string | undefined,
    tier: (row.tier as User["tier"]) ?? "free",
    createdAt: row.created_at as string,
    onboardingStep: (row.onboarding_step as OnboardingStep) ?? "welcome",
    walletAddress: row.wallet_address as string | undefined,
    walletId: row.wallet_id as string | undefined,
  };
}
