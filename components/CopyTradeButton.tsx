"use client";

import { useEffect, useState } from "react";
import { buildCopyReference, getCopyButtonLabel, type CopyMode } from "@/lib/copy-trade";
import { ChainBuyBox } from "@/components/ChainBuyBox";
import type { CopyablePost } from "@/lib/trade-text";

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 16V6a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function canUniswapCopy(post: CopyablePost, mode: CopyMode): boolean {
  if (mode !== "trade") return false;
  if (post.product && post.product !== "chain") return false;
  const c = post.contract?.trim();
  return !!(c && /^0x[a-fA-F0-9]{40}$/i.test(c));
}

export function CopyTradeButton({
  post,
  mode,
  primary = false,
}: {
  post: CopyablePost;
  mode: CopyMode;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const label = getCopyButtonLabel(mode);
  const uniswapEligible = canUniswapCopy(post, mode);

  useEffect(() => {
    if (!uniswapEligible) return;
    let cancelled = false;
    void fetch("/api/viewer/session")
      .then((r) => r.json())
      .then((d: { logged_in?: boolean; chain_wallet?: string | null; has_agent?: boolean }) => {
        if (cancelled) return;
        setWalletReady(!!(d.logged_in && d.chain_wallet && d.has_agent));
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [uniswapEligible]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildCopyReference(post, mode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  if (uniswapEligible && walletReady) {
    const isSell = post.side === "sell";
    const actionLabel = isSell ? "Sell on Uniswap" : "Buy on Uniswap";
    return (
      <div className="copy-trade-uniswap">
        <button
          type="button"
          className={`atlas-btn atlas-btn-sm atlas-btn-copy-trade${showBuy ? " is-active" : ""}`}
          onClick={() => setShowBuy((v) => !v)}
          title={`${isSell ? "Sell" : "Buy"} this token on Uniswap with MetaMask`}
        >
          <CopyIcon />
          {showBuy ? "Close" : actionLabel}
        </button>
        <button
          type="button"
          className="atlas-btn atlas-btn-sm atlas-btn-ghost"
          onClick={copy}
          title="Copy reference for your agent"
          style={{ marginLeft: 6 }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        {showBuy && post.contract ? (
          <div className="copy-trade-uniswap-panel" style={{ marginTop: 10, width: "100%", flexBasis: "100%" }}>
            <ChainBuyBox
              symbol={(post.symbol || "TOKEN").replace(/\.CHAIN$/i, "")}
              contract={post.contract}
              loggedIn
              parentId={post.id}
              compact
              defaultSide={isSell ? "sell" : "buy"}
              defaultAmountToken={
                isSell && post.quantity ? String(post.quantity).replace(/,/g, "") : undefined
              }
              onDone={() => setShowBuy(false)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`atlas-btn atlas-btn-sm atlas-btn-copy-trade${copied ? " is-active" : ""}${primary ? " atlas-btn-primary" : ""}`}
      onClick={copy}
      title="Copy reference for your agent"
    >
      <CopyIcon />
      {copied ? "Copied!" : label}
    </button>
  );
}
