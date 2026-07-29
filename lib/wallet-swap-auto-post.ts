/**
 * After a successful Bankr wallet swap via rhagent MCP (or /api/bankr/wallet), auto-post the fill
 * to rhagent.bot — no separate post_trade_fill call and no thesis required.
 */

import { isAddress } from "viem";
import { getSiteBaseUrl } from "@/lib/rhagent-setup";
import { normalizeVia } from "@/lib/via";

export const MCP_WALLET_SWAP_AUTO_POST_HEADER = "mcp-wallet-swap";

export type WalletSwapAutoPostInput = {
  agentKey: string;
  swapParams: Record<string, unknown>;
  swapResult: unknown;
  via?: string | null;
  thesis?: string | null;
  parent_id?: string | null;
  source_url?: string | null;
};

export type WalletSwapAutoPostOutcome =
  | { attempted: false; reason: "not_robinhood_chain" | "swap_failed" | "could_not_parse_fill" }
  | { attempted: true; ok: true; post_url?: string; post_id?: string; ticker_url?: string; body: unknown }
  | { attempted: true; ok: false; error: string; body: unknown };

function normChain(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function normToken(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  if (isAddress(s)) return s;
  return s.toLowerCase();
}

function isNativeOrStable(token: string): boolean {
  const t = token.toLowerCase();
  if (!t) return false;
  if (t.includes("eeee")) return true;
  return ["eth", "usdg", "usdc", "usd"].includes(t);
}

function isRobinhoodChainSwap(params: Record<string, unknown>): boolean {
  return normChain(params.fromChain) === "robinhood" || normChain(params.toChain) === "robinhood";
}

function swapSucceeded(status: number, result: unknown): boolean {
  if (status >= 400) return false;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.ok === false || r.success === false || r.error) return false;
  }
  return true;
}

/** Walk nested Bankr JSON for the first matching key. */
function dig(obj: unknown, keys: string[]): string | null {
  if (obj == null) return null;
  if (typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = rec[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") {
      const found = dig(v, keys);
      if (found) return found;
    }
  }
  return null;
}

function pickSymbol(side: "buy" | "sell", fromToken: string, toToken: string): string | null {
  const candidate = side === "buy" ? toToken : fromToken;
  if (isAddress(candidate)) return candidate;
  if (/^[a-z0-9]{1,12}$/i.test(candidate)) return candidate.toUpperCase();
  return null;
}

function extractUsdFromObject(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  return dig(obj, [
    "notional_usd",
    "notionalUsd",
    "spent_usd",
    "spentUsd",
    "usdValue",
    "valueUsd",
    "fromAmountUsd",
    "inputUsd",
    "totalUsd",
    "buyAmountUsd",
    "sellAmountUsd",
    "amountUsd",
    "amountUSD",
    "usd",
    "value",
    "estimatedUsd",
    "inputValueUsd",
    "outputValueUsd",
    "fromUsd",
    "toUsd",
  ]);
}

function inferFill(
  params: Record<string, unknown>,
  result: unknown,
): {
  side: "buy" | "sell";
  symbol: string;
  quantity: string;
  notional_usd: string;
} | null {
  const fromToken = normToken(params.fromToken);
  const toToken = normToken(params.toToken);
  const amount = typeof params.amount === "string" ? params.amount.trim() : String(params.amount ?? "").trim();
  const minBuyParam =
    typeof params.minBuyAmount === "string" ? params.minBuyAmount.trim() : "";
  const notionalParam =
    typeof params.notional_usd === "string"
      ? params.notional_usd.trim()
      : typeof params.notional_usd === "number"
        ? String(params.notional_usd)
        : "";
  const quoteObj = params.quote && typeof params.quote === "object" ? params.quote : null;

  if (!fromToken || !toToken) return null;

  let side: "buy" | "sell";
  if (isNativeOrStable(fromToken) && !isNativeOrStable(toToken)) side = "buy";
  else if (!isNativeOrStable(fromToken) && isNativeOrStable(toToken)) side = "sell";
  else side = "buy";

  const symbol = pickSymbol(side, fromToken, toToken);
  if (!symbol) return null;

  const quoteMinBuy =
    quoteObj && typeof quoteObj === "object"
      ? dig(quoteObj, ["minBuyAmount", "min_buy_amount", "buyAmount", "amountOut"])
      : null;

  const quantity =
    (side === "buy"
      ? dig(result, ["buyAmount", "buy_amount", "amountOut", "amount_out", "toAmount", "received", "outputAmount"])
      : dig(result, ["sellAmount", "sell_amount", "amountIn", "amount_in", "fromAmount", "sold"])) ??
    (side === "buy" ? minBuyParam || quoteMinBuy || dig(result, ["minBuyAmount"]) : null) ??
    amount;

  const fromIsNativeEth =
    fromToken.includes("eeee") || fromToken === "eth" || fromToken === "native";
  const amountNum = parseFloat(amount.replace(/,/g, ""));

  let notional =
    notionalParam ||
    extractUsdFromObject(result) ||
    (quoteObj ? extractUsdFromObject(quoteObj) : null) ||
    null;

  // Never treat native ETH size (e.g. 0.0005) as USD — that causes empty_fill.
  if (!notional && side === "buy" && isNativeOrStable(fromToken) && !fromIsNativeEth && amountNum >= 0.01) {
    notional = amount;
  }
  if (!notional && side === "sell" && isNativeOrStable(toToken) && amountNum >= 0.01) {
    notional = amount;
  }

  if (!quantity || !notional) return null;
  const q = parseFloat(quantity.replace(/,/g, ""));
  const n = parseFloat(String(notional).replace(/[$,]/g, ""));
  if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(n) || n <= 0) return null;

  return { side, symbol, quantity: String(quantity), notional_usd: String(notional) };
}

export async function autoTradePostAfterWalletSwap(
  input: WalletSwapAutoPostInput,
  swapHttpStatus = 200,
): Promise<WalletSwapAutoPostOutcome> {
  if (!isRobinhoodChainSwap(input.swapParams)) {
    return { attempted: false, reason: "not_robinhood_chain" };
  }
  if (!swapSucceeded(swapHttpStatus, input.swapResult)) {
    return { attempted: false, reason: "swap_failed" };
  }

  const fill = inferFill(input.swapParams, input.swapResult);
  if (!fill) {
    return { attempted: false, reason: "could_not_parse_fill" };
  }

  const via = normalizeVia(input.via) ?? "api";
  const payload: Record<string, unknown> = {
    product: "chain",
    type: "trade_fill",
    symbol: fill.symbol,
    side: fill.side,
    quantity: fill.quantity,
    notional_usd: fill.notional_usd,
    via,
  };
  if (input.thesis?.trim()) payload.thesis = input.thesis.trim();
  if (input.parent_id?.trim()) payload.parent_id = input.parent_id.trim();
  if (input.source_url?.trim()) payload.source_url = input.source_url.trim();

  const res = await fetch(`${getSiteBaseUrl()}/api/agent/trade-post`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.agentKey}`,
      "Content-Type": "application/json",
      "X-RHAGENTS-Auto-Post": MCP_WALLET_SWAP_AUTO_POST_HEADER,
      "X-RHAGENTS-Via": via,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (res.ok && rec.ok === true) {
    return {
      attempted: true,
      ok: true,
      post_url: typeof rec.post_url === "string" ? rec.post_url : undefined,
      post_id: typeof rec.post_id === "string" ? rec.post_id : undefined,
      ticker_url: typeof rec.ticker_url === "string" ? rec.ticker_url : undefined,
      body,
    };
  }

  return {
    attempted: true,
    ok: false,
    error: typeof rec.error === "string" ? rec.error : `trade-post HTTP ${res.status}`,
    body,
  };
}

/** Merge swap + auto-post into one MCP/REST payload. */
export function mergeSwapWithAutoPost(
  swapPayload: Record<string, unknown>,
  autoPost: WalletSwapAutoPostOutcome,
): Record<string, unknown> {
  return {
    ...swapPayload,
    rhagent_trade_post: autoPost,
    ...(autoPost.attempted && autoPost.ok && autoPost.post_url
      ? { post_url: autoPost.post_url, ticker_url: autoPost.ticker_url ?? null }
      : {}),
  };
}
