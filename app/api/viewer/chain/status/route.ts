import { NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity } from "@/lib/agent-identity";
import { listAgentsOwnedBySession } from "@/lib/agent-owner";
import { checkRhagentHoldings, RHAGENT_MIN_USD, RHAGENT_MIN_TOKENS, normalizeChainWallet } from "@/lib/rhagent-holdings";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { chainSeedRecorded, fetchRhChainEthBalance } from "@/lib/chain-onboard-seed";
import { getOnchainConfig } from "@/lib/onchain-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/viewer/chain/status
 * Hold + Robinhood Chain ETH balance for the logged-in wallet (Privy or MetaMask).
 */
export async function GET() {
  const session = await getViewerSession();
  if (!session?.chain_wallet || !viewerHasIdentity(session)) {
    return NextResponse.json({ ok: false, error: "wallet_session_required" }, { status: 401 });
  }

  const wallet = normalizeChainWallet(session.chain_wallet);
  if (!wallet) {
    return NextResponse.json({ ok: false, error: "invalid_wallet" }, { status: 400 });
  }

  const owned = listAgentsOwnedBySession(session);
  const hold = await checkRhagentHoldings(wallet);
  let rhEth: number | null = null;
  try {
    rhEth = await fetchRhChainEthBalance(wallet);
  } catch {
    rhEth = null;
  }

  const cfg = getOnchainConfig();

  return NextResponse.json({
    ok: true,
    wallet,
    hold_ok: hold.ok,
    hold: hold.ok
      ? {
          balance_tokens: hold.balance_tokens,
          value_usd: hold.value_usd,
          passed_via: hold.passed_via,
        }
      : hold.ok === false
        ? {
            balance_tokens: hold.balance_tokens ?? null,
            value_usd: hold.value_usd ?? null,
            message: hold.error,
            buy_url: hold.buy_url,
          }
        : null,
    requirement: {
      min_tokens: RHAGENT_MIN_TOKENS,
      min_usd: RHAGENT_MIN_USD,
      token: RHAGENT_TOKEN_SYMBOL,
    },
    rh_chain_eth: rhEth,
    seed_available: cfg.enabled && !chainSeedRecorded(wallet),
    seed_recorded: chainSeedRecorded(wallet),
    has_chain_agent: owned.some((a) => a.has_chain && a.chain_wallet),
    agent_username: owned[0]?.username ?? null,
  });
}
