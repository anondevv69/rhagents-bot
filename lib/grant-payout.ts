/**
 * Grant payouts — pays impact grants from RhagentImpactVault.
 *
 * Push, not pull: a bagworker has no ETH for gas, so requiring it to claim would
 * exclude exactly the agents this funds. The authorizer key pays the gas.
 *
 * Every payout is double-guarded. On-chain the vault refuses a second grant for
 * the same postId; off-chain `post_grants` has the postId as PRIMARY KEY and the
 * tx hash as UNIQUE. Either alone would be enough — both means a crash between
 * "transfer succeeded" and "row written" can't silently double-pay on retry,
 * because the chain rejects it.
 */

import { createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodChain, explorerTxUrl } from "@/lib/onchain-config";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { getGrantCandidates, recordGrant, type GrantCandidate } from "@/lib/post-impact";

export const impactVaultAbi = parseAbi([
  "function payGrant(string postId, address payoutWallet, uint256 amount, uint256 score)",
  "function canPay(string postId, address payoutWallet, uint256 amount) view returns (bool ok, string reason)",
  "function isPaid(string postId) view returns (bool)",
  "function remainingDailyBudget() view returns (uint256)",
  "function remainingWalletDaily(address wallet) view returns (uint256)",
  "function maxGrantPerPost() view returns (uint256)",
  "function totalPaid() view returns (uint256)",
  "function grantCount() view returns (uint256)",
  "function paused() view returns (bool)",
]);

const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export function vaultConfig() {
  const address = (process.env.RHAGENT_IMPACT_VAULT_ADDRESS || "").trim();
  let pk = (process.env.RHAGENT_GRANT_AUTHORIZER_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (pk && !pk.startsWith("0x")) pk = `0x${pk}`;
  const enabled = process.env.RHAGENT_GRANTS_ENABLED === "true";
  return {
    address: /^0x[a-fA-F0-9]{40}$/.test(address) ? (address as `0x${string}`) : null,
    authorizerKey: /^0x[a-fA-F0-9]{64}$/.test(pk) ? (pk as `0x${string}`) : null,
    enabled,
    rpcUrl: process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0],
  };
}

function clients() {
  const cfg = vaultConfig();
  if (!cfg.address || !cfg.authorizerKey) return null;
  const transport = http(cfg.rpcUrl);
  const account = privateKeyToAccount(cfg.authorizerKey);
  return {
    cfg,
    account,
    publicClient: createPublicClient({ chain: robinhoodChain, transport }),
    walletClient: createWalletClient({ account, chain: robinhoodChain, transport }),
  };
}

export interface PayoutResult {
  post_id: string;
  agent_id: string;
  username: string | null;
  amount: number;
  score: number;
  status: "paid" | "skipped" | "failed";
  reason?: string;
  tx_hash?: string;
  explorer_url?: string;
}

/**
 * Pay pending impact grants.
 *
 * `dryRun` runs every on-chain precheck without sending a transaction, so the
 * exact set that would be paid can be inspected before real tokens move.
 */
export async function runGrantPayouts(opts: {
  dryRun?: boolean;
  limit?: number;
  days?: number;
} = {}): Promise<{
  ok: boolean;
  enabled: boolean;
  dry_run: boolean;
  vault: string | null;
  vault_balance: number | null;
  remaining_daily_budget: number | null;
  results: PayoutResult[];
  totals: { paid: number; skipped: number; failed: number; tokens: number };
  error?: string;
}> {
  const dryRun = opts.dryRun ?? true;
  const c = clients();

  const empty = {
    results: [] as PayoutResult[],
    totals: { paid: 0, skipped: 0, failed: 0, tokens: 0 },
  };

  if (!c) {
    return {
      ok: false,
      enabled: false,
      dry_run: dryRun,
      vault: null,
      vault_balance: null,
      remaining_daily_budget: null,
      ...empty,
      error:
        "Grants not configured — set RHAGENT_IMPACT_VAULT_ADDRESS and RHAGENT_GRANT_AUTHORIZER_KEY.",
    };
  }
  if (!c.cfg.enabled && !dryRun) {
    return {
      ok: false,
      enabled: false,
      dry_run: dryRun,
      vault: c.cfg.address,
      vault_balance: null,
      remaining_daily_budget: null,
      ...empty,
      error: "RHAGENT_GRANTS_ENABLED is not 'true' — refusing to move real tokens.",
    };
  }

  const vault = c.cfg.address!;
  const rhagentToken = "0x894fAc757250F8E02180E1856957274D84AC4bA3" as const;

  let vaultBalance = 0;
  let remainingBudget = 0;
  try {
    const [bal, budget, paused] = await Promise.all([
      c.publicClient.readContract({ address: rhagentToken, abi: erc20Abi, functionName: "balanceOf", args: [vault] }),
      c.publicClient.readContract({ address: vault, abi: impactVaultAbi, functionName: "remainingDailyBudget" }),
      c.publicClient.readContract({ address: vault, abi: impactVaultAbi, functionName: "paused" }),
    ]);
    vaultBalance = Number(formatUnits(bal as bigint, 18));
    remainingBudget = Number(formatUnits(budget as bigint, 18));
    if (paused) {
      return {
        ok: false,
        enabled: c.cfg.enabled,
        dry_run: dryRun,
        vault,
        vault_balance: vaultBalance,
        remaining_daily_budget: remainingBudget,
        ...empty,
        error: "Vault is paused.",
      };
    }
  } catch (e) {
    return {
      ok: false,
      enabled: c.cfg.enabled,
      dry_run: dryRun,
      vault,
      vault_balance: null,
      remaining_daily_budget: null,
      ...empty,
      error: `Could not read vault: ${e instanceof Error ? e.message : "rpc_error"}`,
    };
  }

  const candidates: GrantCandidate[] = getGrantCandidates({
    days: opts.days ?? 7,
    limit: opts.limit ?? 20,
  });

  const results: PayoutResult[] = [];
  let paid = 0, skipped = 0, failed = 0, tokens = 0;

  for (const cand of candidates) {
    const base: PayoutResult = {
      post_id: cand.post_id,
      agent_id: cand.agent_id,
      username: cand.username,
      amount: cand.suggested_grant,
      score: cand.score,
      status: "skipped",
    };

    if (!cand.payout_wallet) {
      results.push({ ...base, reason: "agent has no payout wallet" });
      skipped++;
      continue;
    }

    const amountWei = parseUnits(String(cand.suggested_grant), 18);

    // Ask the vault first — it is the authority on caps, budget and duplicates,
    // and a failed precheck here is a skip rather than a burnt transaction.
    try {
      const [ok, reason] = (await c.publicClient.readContract({
        address: vault,
        abi: impactVaultAbi,
        functionName: "canPay",
        args: [cand.post_id, cand.payout_wallet as `0x${string}`, amountWei],
      })) as [boolean, string];
      if (!ok) {
        results.push({ ...base, reason });
        skipped++;
        continue;
      }
    } catch (e) {
      results.push({ ...base, status: "failed", reason: `precheck failed: ${e instanceof Error ? e.message : "rpc"}` });
      failed++;
      continue;
    }

    if (dryRun) {
      results.push({ ...base, status: "paid", reason: "dry run — not sent" });
      paid++;
      tokens += cand.suggested_grant;
      continue;
    }

    try {
      const hash = await c.walletClient.writeContract({
        address: vault,
        abi: impactVaultAbi,
        functionName: "payGrant",
        args: [
          cand.post_id,
          cand.payout_wallet as `0x${string}`,
          amountWei,
          BigInt(Math.round(cand.score)),
        ],
      });
      const receipt = await c.publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      if (receipt.status !== "success") {
        results.push({ ...base, status: "failed", reason: "tx reverted", tx_hash: hash });
        failed++;
        continue;
      }

      // The chain is the source of truth; this row is the local mirror. If it
      // fails, the vault still refuses a second payout for this post.
      recordGrant({
        post_id: cand.post_id,
        agent_id: cand.agent_id,
        amount: cand.suggested_grant,
        score: cand.score,
        tx_hash: hash,
        wallet: cand.payout_wallet,
      });

      results.push({
        ...base,
        status: "paid",
        tx_hash: hash,
        explorer_url: explorerTxUrl(hash),
      });
      paid++;
      tokens += cand.suggested_grant;
    } catch (e) {
      results.push({
        ...base,
        status: "failed",
        reason: e instanceof Error ? e.message.slice(0, 200) : "send failed",
      });
      failed++;
    }
  }

  return {
    ok: true,
    enabled: c.cfg.enabled,
    dry_run: dryRun,
    vault,
    vault_balance: vaultBalance,
    remaining_daily_budget: remainingBudget,
    results,
    totals: { paid, skipped, failed, tokens },
  };
}

export function grantPayoutStatus() {
  const cfg = vaultConfig();
  return {
    configured: !!cfg.address && !!cfg.authorizerKey,
    enabled: cfg.enabled,
    vault: cfg.address,
    token: RHAGENT_TOKEN_SYMBOL,
    note: cfg.enabled
      ? "Live — grants move real tokens."
      : "Dry-run only. Set RHAGENT_GRANTS_ENABLED=true to pay for real.",
  };
}
