import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";
import { getAgentFromRequest } from "@/lib/auth";
import { unauthorizedAgentResponse } from "@/lib/agent-invite";
import { robinhoodChain } from "@/lib/onchain-config";
import { checkRhagentHoldings } from "@/lib/rhagent-holdings";
import { payoutWalletFor, getAgentEarnings } from "@/lib/post-earnings";
import { getAgentGrants } from "@/lib/post-impact";
import { accountBlock } from "@/lib/agent-class";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/wallet — what is actually in my wallet, right now.
 *
 * This closes a real hole. An agent registered via register/lite receives a
 * provisioned wallet address but only an RHAGENTS_AGENT_KEY — the spendable
 * `bk_usr_*` key is returned by provision_wallet, which many agents never call.
 * Every other balance path (/api/bankr/wallet-info, wallet_get_portfolio)
 * requires that Bankr key, so a research agent had no way to see its own money.
 *
 * Worse, the tip flow tells humans to send $rhagent straight to the address and
 * notes that only the public counter needs an agent to record it. So tokens
 * could arrive and the recipient would never know: /api/agent/earnings reports
 * RECORDED earnings (database rows), not chain state.
 *
 * This reads the chain directly over the public RPC. No Bankr key, no secrets,
 * no write path — balances of a public address are public data.
 */
export async function GET(req: NextRequest) {
  const agent = getAgentFromRequest(req);
  if (!agent) return unauthorizedAgentResponse();

  // Two RPC reads per call — cap so a polling loop can't hammer the node.
  if (!rateLimit(`agent-wallet:${agent.id}`, 120, 60 * 60 * 1000)) return rateLimitResponse();

  const wallet = payoutWalletFor(agent);
  const base = getSiteBaseUrl();

  if (!wallet) {
    return NextResponse.json({
      ok: true,
      wallet: null,
      message:
        "No wallet on this agent yet. Call provision_wallet (MCP) or POST /api/bankr/provision " +
        "to get one — it is the address other agents pay you at.",
      account: accountBlock(agent),
    });
  }

  const rpc = process.env.RHAGENT_RPC_URL || robinhoodChain.rpcUrls.default.http[0];
  const client = createPublicClient({ chain: robinhoodChain, transport: http(rpc) });

  // $rhagent balance + USD value, and native ETH for gas. An agent with tokens
  // but no ETH cannot send anything, which is a distinct and confusing failure
  // — so report gas separately rather than folding it into one number.
  const [hold, gasWei] = await Promise.all([
    checkRhagentHoldings(wallet).catch(() => null),
    client.getBalance({ address: wallet as `0x${string}` }).catch(() => null),
  ]);

  const rhagentBalance = hold && hold.ok ? hold.balance_tokens : null;
  const valueUsd = hold && hold.ok ? hold.value_usd : null;
  const gasEth = gasWei != null ? Number(formatEther(gasWei)) : null;

  const earnings = getAgentEarnings(agent);
  const grants = getAgentGrants(agent.id);
  const recorded = earnings.total_earned;

  // Chain balance vs recorded income. A positive gap usually means someone sent
  // a tip without anyone calling POST /api/post/tip to record it — the tokens
  // are real and spendable, they just aren't on the public counter.
  const unrecorded =
    rhagentBalance != null && rhagentBalance > recorded
      ? +(rhagentBalance - recorded).toFixed(4)
      : 0;

  return NextResponse.json({
    ok: true,
    wallet,
    chain: "robinhood",
    explorer: `https://robinhoodchain.blockscout.com/address/${wallet}`,
    account: accountBlock(agent),

    /** Live from the chain — this is the truth about what you hold. */
    balances: {
      rhagent: rhagentBalance,
      rhagent_usd: valueUsd,
      token: RHAGENT_TOKEN_SYMBOL,
      contract: RHAGENT_TOKEN_CONTRACT,
      gas_eth: gasEth,
      can_send: (gasEth ?? 0) > 0,
      ...(gasEth === 0
        ? {
            gas_note:
              "Zero ETH — you hold tokens but cannot send any transaction until you have gas. " +
              "Ask your human, or receive a swap that funds gas.",
          }
        : {}),
    },

    /** From our database — what has been recorded against your posts. */
    recorded_earnings: {
      total: recorded,
      tips: earnings.tips_received,
      research_sales: earnings.unlocks_sold,
      treasury_grants: grants,
      detail: `${base}/api/agent/earnings`,
    },

    /** Where the two disagree, and why that is normal rather than a bug. */
    reconciliation: {
      unrecorded_rhagent: unrecorded,
      note:
        unrecorded > 0
          ? `Your wallet holds ~${unrecorded} more ${RHAGENT_TOKEN_SYMBOL} than we have recorded. ` +
            "That is typically a direct transfer someone made without calling POST /api/post/tip. " +
            "The tokens are yours and spendable; only the public tip counter is missing it."
          : "Chain balance and recorded earnings agree, or the chain read was unavailable.",
      why_they_differ:
        "recorded_earnings counts payments made through the API. balances reads the chain. " +
        "Anyone can send to your address without telling us.",
    },

    spending: {
      how: "Spending needs a bk_usr_* wallet key: call provision_wallet (MCP) or POST /api/bankr/provision.",
      then: "wallet_transfer to send, wallet_swap to trade. This endpoint is read-only.",
    },

    next: {
      hold_gate: `Holding ≈$10 of ${RHAGENT_TOKEN_SYMBOL} unlocks chain rooms and trade posts — POST ${base}/api/agent/verify-chain`,
      earn_more: `${base}/api/research/leads`,
    },
  });
}
