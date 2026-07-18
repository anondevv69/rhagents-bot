/**
 * Link a Robinhood Chain wallet to an agent after signature proof + $rhagent hold check.
 */

import { getDb } from "@/lib/db";
import { verifyChainWalletOwnership } from "@/lib/chain-proof";
import { checkRhagentHoldings, holdFailResponse, type HoldCheckOk } from "@/lib/rhagent-holdings";

export type LinkChainSuccess = {
  ok: true;
  chain_wallet: `0x${string}`;
  hold: {
    balance_tokens: number;
    value_usd: number | null;
    passed_via: HoldCheckOk["passed_via"];
  };
};

export type LinkChainFail = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

/**
 * Shared tail once a wallet address is proven (by signature OR matching bankr_api_key):
 * reject if already claimed by another agent, re-check the $rhagent hold, then write.
 */
async function finalizeChainWalletLink(
  agentId: string,
  wallet: `0x${string}`,
): Promise<LinkChainSuccess | LinkChainFail> {
  const taken = getDb()
    .prepare(`SELECT id FROM agents WHERE chain_wallet = ? AND id != ?`)
    .get(wallet.toLowerCase(), agentId) as { id: string } | undefined;
  if (taken) {
    return {
      ok: false,
      status: 409,
      body: { ok: false, error: "This chain wallet is already linked to another agent" },
    };
  }

  const hold = await checkRhagentHoldings(wallet);
  if (!hold.ok) {
    return { ok: false, status: 403, body: holdFailResponse(hold) };
  }

  getDb()
    .prepare(
      `UPDATE agents SET has_chain = 1, chain_wallet = ?, capability_proof = 'token_hold' WHERE id = ?`,
    )
    .run(hold.wallet.toLowerCase(), agentId);

  // Mint identity NFT to the verified Chain wallet (fire-and-forget).
  void import("@/lib/inscriber").then(async ({ scheduleInscribeAgent }) => {
    const agent = getDb().prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as
      | import("@/lib/db").Agent
      | undefined;
    if (agent) scheduleInscribeAgent(agent);
  });

  return {
    ok: true,
    chain_wallet: hold.wallet,
    hold: {
      balance_tokens: hold.balance_tokens,
      value_usd: hold.value_usd,
      passed_via: hold.passed_via,
    },
  };
}

/**
 * Requires a personal_sign challenge (nonce + signature). Does not accept bankr_api_key —
 * dashboard / owner connect must prove control of the wallet in-browser.
 */
export async function linkSignedChainWallet(
  agentId: string,
  opts: { chain_wallet: string; nonce: string; signature: string },
): Promise<LinkChainSuccess | LinkChainFail> {
  const ownership = await verifyChainWalletOwnership({
    chain_wallet: opts.chain_wallet,
    nonce: opts.nonce,
    signature: opts.signature,
  });
  if (!ownership.ok) {
    return { ok: false, status: 400, body: { ok: false, error: ownership.error } };
  }
  return finalizeChainWalletLink(agentId, ownership.wallet);
}

/**
 * Bankr's own wallet-ownership proof (their EVM wallet matches chain_wallet) — no
 * personal_sign needed since Bankr already authenticated the wallet. Agent-CLI path only.
 */
export async function linkBankrChainWallet(
  agentId: string,
  wallet: `0x${string}`,
): Promise<LinkChainSuccess | LinkChainFail> {
  return finalizeChainWalletLink(agentId, wallet);
}
