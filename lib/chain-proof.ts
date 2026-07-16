/**
 * Prove ownership of a Robinhood Chain wallet via personal_sign.
 */

import { randomBytes } from "crypto";
import { verifyMessage } from "viem";
import { getDb } from "@/lib/db";
import { normalizeChainWallet } from "@/lib/rhagent-holdings";

const TTL_MS = 10 * 60 * 1000;

export function buildChainLinkMessage(wallet: `0x${string}`, nonce: string, expiresAt: string): string {
  return [
    "Sign in to rhagent.bot with this Robinhood Chain wallet",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
    "",
    "Only sign if you control this wallet.",
  ].join("\n");
}

/** Create a short-lived signing challenge for a wallet. */
export function createChainWalletChallenge(walletRaw: string): {
  ok: true;
  wallet: `0x${string}`;
  nonce: string;
  message: string;
  expires_at: string;
} | { ok: false; error: string } {
  const wallet = normalizeChainWallet(walletRaw);
  if (!wallet) return { ok: false, error: "Invalid chain_wallet" };

  const nonce = "rhc_" + randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const message = buildChainLinkMessage(wallet, nonce, expiresAt);

  getDb()
    .prepare(
      `INSERT INTO chain_wallet_challenges (nonce, wallet, message, expires_at) VALUES (?, ?, ?, ?)`
    )
    .run(nonce, wallet.toLowerCase(), message, expiresAt);

  return { ok: true, wallet, nonce, message, expires_at: expiresAt };
}

export async function verifyChainWalletOwnership(opts: {
  chain_wallet: string;
  signature: string;
  nonce: string;
}): Promise<{ ok: true; wallet: `0x${string}` } | { ok: false; error: string }> {
  const wallet = normalizeChainWallet(opts.chain_wallet);
  if (!wallet) return { ok: false, error: "Invalid chain_wallet" };
  const nonce = opts.nonce.trim();
  const signature = opts.signature.trim();
  if (!nonce || !signature) return { ok: false, error: "nonce and signature required" };

  const row = getDb()
    .prepare(
      `SELECT nonce, wallet, message, used, expires_at FROM chain_wallet_challenges WHERE nonce = ?`
    )
    .get(nonce) as
    | { nonce: string; wallet: string; message: string; used: number; expires_at: string }
    | undefined;

  if (!row) return { ok: false, error: "Unknown nonce — GET /api/agent/chain/challenge first" };
  if (row.used) return { ok: false, error: "Nonce already used" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Nonce expired — request a new challenge" };
  }
  if (row.wallet.toLowerCase() !== wallet.toLowerCase()) {
    return { ok: false, error: "Wallet does not match challenge" };
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: wallet,
      message: row.message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return { ok: false, error: "Invalid signature" };
  }
  if (!valid) return { ok: false, error: "Signature verification failed" };

  getDb().prepare(`UPDATE chain_wallet_challenges SET used = 1 WHERE nonce = ?`).run(nonce);
  return { ok: true, wallet };
}
