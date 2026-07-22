"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  executeChainSwap,
  walletErrorMessage,
  type SwapQuoteClient,
} from "@/lib/browser-uniswap-swap";

type QuoteResponse = SwapQuoteClient & {
  ok?: boolean;
  error?: string;
  message?: string;
  notional_usd?: number | null;
  eth_usd?: number | null;
  slippage_bps?: number;
  amountEth?: string;
  amountToken?: string;
  token_balance?: string | null;
  side?: "buy" | "sell";
};

type Mode = "buy" | "sell" | "post";

type Props = {
  symbol: string;
  contract?: string | null;
  loggedIn: boolean;
  parentId?: string | null;
  defaultAmountEth?: string;
  defaultAmountToken?: string;
  /** Prefill buy vs sell (e.g. copy-trade of a sell). */
  defaultSide?: "buy" | "sell";
  loginHref?: string;
  nextPath?: string;
  compact?: boolean;
  combined?: boolean;
  onDone?: (result: { post_url?: string; tx_hash?: string }) => void;
};

const BUY_PRESETS = ["0.001", "0.005", "0.01"] as const;
const SELL_PRESETS = ["1000", "10000", "100000"] as const;

/**
 * Normie Chain actions: Uniswap buy/sell with optional thesis, or post-only.
 */
export function ChainBuyBox({
  symbol,
  contract,
  loggedIn,
  parentId,
  defaultAmountEth = "0.001",
  defaultAmountToken = "1000",
  defaultSide = "buy",
  loginHref = "/login",
  nextPath,
  compact = false,
  combined = false,
  onDone,
}: Props) {
  const router = useRouter();
  const hasContract = !!(contract && /^0x[a-fA-F0-9]{40}$/i.test(contract));
  const showCombined = combined && !compact && !parentId;
  const [mode, setMode] = useState<Mode>(
    hasContract ? (defaultSide === "sell" ? "sell" : "buy") : "post",
  );
  const [amountEth, setAmountEth] = useState(defaultAmountEth);
  const [amountToken, setAmountToken] = useState(defaultAmountToken);
  const [thesis, setThesis] = useState(parentId ? "Copied this trade." : "");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

  const loginNext =
    nextPath ?? `/tickers/${encodeURIComponent(symbol)}?product=chain`;

  const tradeMode = mode === "buy" || mode === "sell";

  const refreshQuote = useCallback(async () => {
    if (!loggedIn || !hasContract || !contract) return;
    if (showCombined && !tradeMode) return;
    if (mode === "sell" && !amountToken.trim()) return;
    if (mode === "buy" && !amountEth.trim()) return;

    setQuoting(true);
    setQuoteError(null);
    try {
      const q = new URLSearchParams({
        token: contract,
        side: mode === "sell" ? "sell" : "buy",
      });
      if (mode === "sell") q.set("amount_token", amountToken);
      else q.set("amount_eth", amountEth);

      const res = await fetch(`/api/viewer/swap/quote?${q}`);
      const data = (await res.json()) as QuoteResponse;
      if (!res.ok || data.ok === false) {
        setQuote(null);
        setQuoteError(data.message || data.error || `Quote failed (${res.status})`);
        return;
      }
      setQuote(data);
      if (data.token_balance != null) setTokenBalance(data.token_balance);
    } catch (err) {
      setQuote(null);
      setQuoteError(err instanceof Error ? err.message : "Quote failed");
    } finally {
      setQuoting(false);
    }
  }, [
    loggedIn,
    hasContract,
    contract,
    showCombined,
    tradeMode,
    mode,
    amountEth,
    amountToken,
  ]);

  useEffect(() => {
    if (!loggedIn || !hasContract) return;
    if (showCombined && !tradeMode) return;
    const t = setTimeout(() => {
      void refreshQuote();
    }, 400);
    return () => clearTimeout(t);
  }, [loggedIn, hasContract, showCombined, tradeMode, refreshQuote]);

  async function postThesisOnly() {
    const text = thesis.trim();
    if (!text) throw new Error("Write a thesis to post.");
    const res = await fetch("/api/viewer/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "chain",
        symbol: hasContract && contract ? contract : symbol,
        body: text,
        type: parentId ? "comment" : "general",
        parent_id: parentId || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      post_url?: string;
    };
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || data.error || `Post failed (${res.status})`);
    }
    return data;
  }

  async function swapWithThesis(side: "buy" | "sell") {
    if (!hasContract || !contract) throw new Error("Missing token contract.");
    let q = quote;
    if (!q?.calldata || q.side !== side) {
      setStatus("Getting quote…");
      const params = new URLSearchParams({ token: contract, side });
      if (side === "sell") params.set("amount_token", amountToken);
      else params.set("amount_eth", amountEth);
      const res = await fetch(`/api/viewer/swap/quote?${params}`);
      const data = (await res.json()) as QuoteResponse;
      if (!res.ok || data.ok === false) {
        throw new Error(data.message || data.error || "Quote failed");
      }
      q = data;
      setQuote(data);
    }

    const { txHash } = await executeChainSwap(
      { ...q, side, token: contract },
      { onStatus: setStatus },
    );

    setStatus("Posting fill…");
    const thesisText = thesis.trim();
    const ethAmt = Number(q.amountEth ?? q.amountInEth ?? 0);
    const notional =
      q.notional_usd != null && Number.isFinite(q.notional_usd)
        ? q.notional_usd
        : Number.isFinite(ethAmt)
          ? ethAmt * (q.eth_usd && q.eth_usd > 0 ? q.eth_usd : 2500)
          : null;

    const quantity =
      side === "buy"
        ? q.amountToken || q.amountOut
        : q.amountToken || q.amountIn || amountToken;

    const postRes = await fetch("/api/viewer/trade-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "chain",
        symbol: contract,
        side,
        quantity,
        notional_usd: notional != null ? String(Math.max(notional, 0.01)) : undefined,
        thesis: thesisText || undefined,
        parent_id: parentId || undefined,
        tx_hash: txHash,
        via: "rhagent_web_wallet",
      }),
    });
    const postData = (await postRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      post_url?: string;
    };
    if (!postRes.ok || postData.ok === false) {
      throw new Error(
        postData.message ||
          postData.error ||
          `Swap sent (${txHash.slice(0, 10)}…) but fill post failed (${postRes.status})`,
      );
    }
    return { ...postData, tx_hash: txHash };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !loggedIn) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      if ((showCombined && mode === "post") || !hasContract) {
        setStatus("Posting…");
        const data = await postThesisOnly();
        setThesis("");
        setStatus("Done");
        onDone?.({ post_url: data.post_url });
        router.refresh();
        return;
      }

      const side = mode === "sell" ? "sell" : "buy";
      const data = await swapWithThesis(side);
      setStatus("Done");
      setThesis(parentId ? "Copied this trade." : "");
      onDone?.({ post_url: data.post_url, tx_hash: data.tx_hash });
      router.refresh();
    } catch (err) {
      setError(
        walletErrorMessage(
          err,
          mode === "post" ? "Post failed" : mode === "sell" ? "Sell failed" : "Buy failed",
        ),
      );
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!showCombined && !hasContract) {
    return null;
  }

  if (!loggedIn) {
    return (
      <div className={`panel chain-buy${compact ? " chain-buy--compact" : ""}`}>
        <p className="owner-settings-note" style={{ marginBottom: 10 }}>
          {showCombined
            ? `Connect your wallet to buy or sell $${symbol} on Uniswap, or post a thesis.`
            : `Connect your wallet to trade $${symbol} on Uniswap (on-chain).`}
        </p>
        <a href={`${loginHref}?next=${encodeURIComponent(loginNext)}`} className="btn btn-primary">
          Connect wallet
        </a>
      </div>
    );
  }

  const postMode = showCombined && mode === "post";
  const buyMode = mode === "buy";
  const sellMode = mode === "sell";

  return (
    <form
      className={`panel chain-buy${compact ? " chain-buy--compact" : ""}${showCombined ? " chain-buy--combined" : ""}`}
      onSubmit={onSubmit}
    >
      {showCombined ? (
        <div className="chain-buy-modes" role="tablist" aria-label="Buy, sell, or post">
          {(
            [
              ["buy", "Buy + thesis", !hasContract],
              ["sell", "Sell + thesis", !hasContract],
              ["post", "Post only", false],
            ] as const
          ).map(([id, label, disabled]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`chain-buy-mode${mode === id ? " chain-buy-mode--active" : ""}`}
              disabled={disabled || busy}
              onClick={() => {
                setMode(id);
                setError(null);
                setStatus(null);
                setQuote(null);
                setQuoteError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <label
          className="owner-settings-note"
          htmlFor={compact ? `chain-swap-amt-${contract}` : "chain-swap-amount"}
          style={{ display: "block", marginBottom: 8 }}
        >
          {defaultSide === "sell" ? "Sell" : "Buy"} ${symbol} on Uniswap
          <span style={{ opacity: 0.7 }}>
            {" "}
            — {defaultSide === "sell" ? "token → ETH" : "ETH → token"}
          </span>
        </label>
      )}

      {buyMode && hasContract ? (
        <>
          {showCombined ? (
            <p className="owner-settings-note" style={{ marginBottom: 8 }}>
              Buy ${symbol} on Uniswap, then post the fill
              {thesis.trim() ? " with your thesis" : ""}.
            </p>
          ) : null}
          <div
            className="chain-buy-row"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
          >
            <input
              id={compact ? `chain-swap-amt-${contract}` : "chain-swap-amount"}
              className="input"
              type="text"
              inputMode="decimal"
              value={amountEth}
              onChange={(e) => setAmountEth(e.target.value)}
              disabled={busy}
              aria-label="ETH amount"
              style={{ width: 120 }}
            />
            <span className="owner-settings-note" style={{ alignSelf: "center" }}>
              ETH
            </span>
            {BUY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setAmountEth(p)}
                style={{ padding: "6px 10px", fontSize: 12 }}
              >
                {p}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {sellMode && hasContract ? (
        <>
          {showCombined ? (
            <p className="owner-settings-note" style={{ marginBottom: 8 }}>
              Sell ${symbol} for ETH on Uniswap, then post the fill
              {thesis.trim() ? " with your thesis" : ""}.
              {tokenBalance != null ? (
                <span style={{ opacity: 0.75 }}>
                  {" "}
                  Balance: {Number(tokenBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              ) : null}
            </p>
          ) : null}
          <div
            className="chain-buy-row"
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
          >
            <input
              id={compact ? `chain-sell-amt-${contract}` : "chain-sell-amount"}
              className="input"
              type="text"
              inputMode="decimal"
              value={amountToken}
              onChange={(e) => setAmountToken(e.target.value)}
              disabled={busy}
              aria-label={`${symbol} amount`}
              style={{ width: 140 }}
            />
            <span className="owner-settings-note" style={{ alignSelf: "center" }}>
              ${symbol}
            </span>
            {SELL_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setAmountToken(p)}
                style={{ padding: "6px 10px", fontSize: 12 }}
              >
                {Number(p).toLocaleString()}
              </button>
            ))}
            {tokenBalance && Number(tokenBalance) > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setAmountToken(tokenBalance)}
                style={{ padding: "6px 10px", fontSize: 12 }}
              >
                Max
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {tradeMode && hasContract ? (
        <div className="owner-settings-note" style={{ marginBottom: 10, minHeight: 20 }}>
          {quoting
            ? "Quoting…"
            : quoteError
              ? quoteError
              : quote
                ? buyMode
                  ? `≈ ${Number(quote.amountToken || quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}${
                      quote.notional_usd != null ? ` · ~$${quote.notional_usd.toFixed(2)}` : ""
                    }`
                  : `≈ ${Number(quote.amountEth || quote.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH${
                      quote.notional_usd != null ? ` · ~$${quote.notional_usd.toFixed(2)}` : ""
                    }`
                : null}
        </div>
      ) : null}

      {postMode ? (
        <p className="owner-settings-note" style={{ marginBottom: 8 }}>
          Post in ${symbol}
          <span style={{ opacity: 0.7 }}> — requires $rhagent + holding this token</span>
        </p>
      ) : null}

      <textarea
        className="input"
        rows={compact ? 2 : 3}
        maxLength={1000}
        value={thesis}
        onChange={(e) => setThesis(e.target.value)}
        placeholder={
          parentId
            ? "Optional thesis (copy-trade)…"
            : postMode
              ? "Share a thesis, update, or comment…"
              : sellMode
                ? "Optional thesis to post with this sell…"
                : "Optional thesis to post with this buy…"
        }
        disabled={busy}
        style={{ width: "100%", resize: "vertical", marginBottom: 10 }}
      />

      {error ? (
        <p className="owner-settings-note" style={{ color: "var(--danger, #e55)", marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      {status && !error ? (
        <p className="owner-settings-note" style={{ marginBottom: 8 }}>
          {status}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={
          busy ||
          (tradeMode && hasContract
            ? quoting ||
              !!quoteError ||
              (buyMode ? !amountEth : !amountToken)
            : !thesis.trim())
        }
      >
        {busy
          ? tradeMode
            ? sellMode
              ? "Selling…"
              : "Buying…"
            : "Posting…"
          : parentId
            ? defaultSide === "sell"
              ? "Copy sell on Uniswap"
              : "Copy buy on Uniswap"
            : sellMode
              ? "Sell on Uniswap"
              : buyMode
                ? "Buy on Uniswap"
                : "Post"}
      </button>
    </form>
  );
}
