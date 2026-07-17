import { NextRequest, NextResponse } from "next/server";
import { getViewerSession } from "@/lib/viewerSession";
import { viewerHasIdentity, viewerIdentityKey } from "@/lib/agent-identity";
import { resolveOwnedAgentForViewer } from "@/lib/viewer-agent";
import {
  fetchEthUsd,
  fetchTokenBalance,
  quoteChainSwap,
  type SwapSide,
} from "@/lib/uniswap-rh-chain";
import { resolveChainTicker } from "@/lib/chain-tokens";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isAddress } from "viem";

/**
 * GET /api/viewer/swap/quote?token=0x…&side=buy|sell&amount_eth=0.001&amount_token=1000
 */
export async function GET(req: NextRequest) {
  const session = await getViewerSession();
  if (!viewerHasIdentity(session)) {
    return NextResponse.json(
      { ok: false, error: "Log in with MetaMask to quote a swap." },
      { status: 401 },
    );
  }

  const who = viewerIdentityKey(session!);
  if (!rateLimit(`viewer-swap-quote:${who}`, 60, 60 * 1000)) {
    return rateLimitResponse();
  }

  const agent = resolveOwnedAgentForViewer(session);
  if (!agent?.chain_wallet) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_agent",
        message: "Create a Chain account with MetaMask first.",
      },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const tokenRaw = (sp.get("token") || sp.get("contract") || "").trim();
  const sideRaw = (sp.get("side") || "buy").trim().toLowerCase();
  const side: SwapSide = sideRaw === "sell" ? "sell" : "buy";
  const amountEth = (sp.get("amount_eth") || sp.get("amount") || "0.001").trim();
  const amountToken = (sp.get("amount_token") || "").trim();
  const recipientRaw = (sp.get("recipient") || agent.chain_wallet).trim();
  const slippageRaw = sp.get("slippage_bps");
  const slippageBps = slippageRaw ? Number(slippageRaw) : undefined;

  if (!tokenRaw) {
    return NextResponse.json({ ok: false, error: "token required (0x… or ticker)" }, { status: 400 });
  }

  let token = tokenRaw;
  if (!isAddress(tokenRaw)) {
    const resolved = await resolveChainTicker(tokenRaw);
    if ("error" in resolved || !("contract" in resolved) || !resolved.contract) {
      return NextResponse.json(
        {
          ok: false,
          error: "token_unresolved",
          message: "Pass a Robinhood Chain contract (0x…) or an open Chain ticker.",
        },
        { status: 400 },
      );
    }
    token = resolved.contract;
  }

  if (side === "sell" && !amountToken) {
    return NextResponse.json(
      { ok: false, error: "amount_token required for sells" },
      { status: 400 },
    );
  }

  const quote = await quoteChainSwap({
    side,
    token,
    amountEth: side === "buy" ? amountEth : undefined,
    amountToken: side === "sell" ? amountToken : undefined,
    recipient: recipientRaw,
    slippageBps,
  });

  if (!quote.ok) {
    return NextResponse.json(quote, { status: 400 });
  }

  const ethUsd = await fetchEthUsd();
  const ethForNotional = Number(quote.amountEth);
  const notionalUsd =
    ethUsd != null && Number.isFinite(ethForNotional) ? ethForNotional * ethUsd : null;

  const bal = side === "sell" ? await fetchTokenBalance(agent.chain_wallet, token) : null;

  const { ok: _ok, ...quoteFields } = quote;
  return NextResponse.json({
    ok: true,
    ...quoteFields,
    // Back-compat with buy UI
    tokenOut: quote.token,
    amountInEth: quote.side === "buy" ? quote.amountEth : quote.amountOut,
    amountInWei: quote.amountInRaw,
    eth_usd: ethUsd,
    notional_usd: notionalUsd != null && Number.isFinite(notionalUsd) ? notionalUsd : null,
    wallet: agent.chain_wallet,
    token_balance: bal && bal.ok ? bal.balance : null,
    token_balance_raw: bal && bal.ok ? bal.balanceRaw : null,
  });
}
