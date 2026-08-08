/**
 * One-time Robinhood Chain ETH seed so Privy / wallet-first users can swap for $RHAGENT.
 * Paid from the inscriber hot wallet — rate-limited, idempotent per recipient.
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDb } from "@/lib/db";
import { getOnchainConfig, robinhoodChain } from "@/lib/onchain-config";
import { normalizeChainWallet } from "@/lib/rhagent-holdings";
import { ONBOARD_SEED_ETH_DEFAULT } from "@/lib/privy-funding-constants";

export function chainSeedRecorded(wallet: string): boolean {
  const w = normalizeChainWallet(wallet);
  if (!w) return false;
  const row = getDb()
    .prepare(`SELECT wallet FROM chain_onboard_seeds WHERE LOWER(wallet) = ?`)
    .get(w.toLowerCase()) as { wallet: string } | undefined;
  return !!row;
}

export async function fetchRhChainEthBalance(wallet: `0x${string}`): Promise<number> {
  const cfg = getOnchainConfig();
  const client = createPublicClient({
    chain: robinhoodChain,
    transport: http(cfg.rpcUrl),
  });
  const wei = await client.getBalance({ address: wallet });
  return Number(formatEther(wei));
}

export async function seedSwapEthForWallet(
  walletRaw: string,
): Promise<{ ok: true; tx_hash: `0x${string}`; amount_eth: string } | { ok: false; error: string }> {
  const wallet = normalizeChainWallet(walletRaw);
  if (!wallet) return { ok: false, error: "invalid_wallet" };

  if (chainSeedRecorded(wallet)) {
    return { ok: false, error: "already_seeded" };
  }

  const cfg = getOnchainConfig();
  if (!cfg.inscriberPrivateKey) {
    return { ok: false, error: "seed_disabled" };
  }

  const amountStr = (process.env.RHAGENT_ONBOARD_SEED_ETH?.trim() || ONBOARD_SEED_ETH_DEFAULT).trim();
  let value: bigint;
  try {
    value = parseEther(amountStr);
  } catch {
    return { ok: false, error: "invalid_seed_amount_config" };
  }
  if (value <= BigInt(0)) return { ok: false, error: "invalid_seed_amount_config" };

  const account = privateKeyToAccount(cfg.inscriberPrivateKey);
  const transport = http(cfg.rpcUrl);
  const publicClient = createPublicClient({ chain: robinhoodChain, transport });
  const walletClient = createWalletClient({ account, chain: robinhoodChain, transport });

  try {
    const hash = await walletClient.sendTransaction({
      to: wallet,
      value,
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });

    getDb()
      .prepare(`INSERT INTO chain_onboard_seeds (wallet, tx_hash, amount_eth) VALUES (?, ?, ?)`)
      .run(wallet.toLowerCase(), hash, amountStr);

    return { ok: true, tx_hash: hash, amount_eth: amountStr };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "seed_tx_failed",
    };
  }
}
