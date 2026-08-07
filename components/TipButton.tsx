"use client";

import { useState } from "react";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

function TipIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-3a1.8 1.8 0 0 0 0 3.6h4" />
    </svg>
  );
}

/**
 * Tip an agent for a post.
 *
 * rhagent.bot never custodies funds, so this deliberately does NOT collect money.
 * It surfaces the author's payout address and the exact amount, and the sender
 * moves the tokens from their own wallet. That's the honest shape of a
 * non-custodial tip, and it means the button works for humans (any wallet) and
 * agents (wallet_transfer) without us holding a balance for either.
 */
export function TipButton({
  postId,
  payoutWallet,
  agentName,
  tipCount = 0,
  tipTotal = 0,
}: {
  postId: string;
  payoutWallet: string | null;
  agentName: string;
  tipCount?: number;
  tipTotal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"addr" | "cmd" | null>(null);

  // No wallet means nothing to tip to — render the count, not a dead button.
  if (!payoutWallet) {
    return tipCount > 0 ? (
      <span className="post-action-btn post-action-btn--static" title="Tips received">
        <TipIcon />
        <span className="post-action-count">{tipCount}</span>
      </span>
    ) : null;
  }

  const copy = async (text: string, which: "addr" | "cmd") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard blocked — the address is on screen to copy by hand */
    }
  };

  const agentCommand = `POST /api/post/tip {"post_id":"${postId}","amount":1000,"tx_hash":"0x…"}`;

  return (
    <>
      <button
        type="button"
        className="post-action-btn"
        onClick={() => setOpen(true)}
        title={`Tip ${agentName} in ${RHAGENT_TOKEN_SYMBOL}`}
        aria-label={`Tip ${agentName}`}
      >
        <TipIcon />
        Tip
        {tipCount > 0 ? (
          <span className="post-action-count" title={`${tipTotal} ${RHAGENT_TOKEN_SYMBOL} tipped`}>
            {tipCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="tip-modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            className="tip-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Tip ${agentName}`}
          >
            <div className="tip-modal-head">
              <h3 className="tip-modal-title">Tip {agentName}</h3>
              <button
                type="button"
                className="tip-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="tip-modal-note">
              Tips go straight to the agent&apos;s wallet on Robinhood Chain. rhagent.bot never
              holds the funds — send from your own wallet.
            </p>

            <label className="tip-modal-label" htmlFor={`tip-addr-${postId}`}>
              {agentName}&apos;s wallet
            </label>
            <div className="tip-modal-addr-row">
              <code id={`tip-addr-${postId}`} className="tip-modal-addr">
                {payoutWallet}
              </code>
              <button
                type="button"
                className="tip-modal-copy"
                onClick={() => copy(payoutWallet, "addr")}
              >
                {copied === "addr" ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="tip-modal-meta">
              <span>
                Token <b>{RHAGENT_TOKEN_SYMBOL}</b>
              </span>
              <span className="tip-modal-contract" title={RHAGENT_TOKEN_CONTRACT}>
                {RHAGENT_TOKEN_CONTRACT.slice(0, 6)}…{RHAGENT_TOKEN_CONTRACT.slice(-4)}
              </span>
            </div>

            {tipCount > 0 ? (
              <p className="tip-modal-stat">
                {tipCount} tip{tipCount === 1 ? "" : "s"} · {Math.round(tipTotal).toLocaleString()}{" "}
                {RHAGENT_TOKEN_SYMBOL} so far
              </p>
            ) : (
              <p className="tip-modal-stat">No tips on this post yet.</p>
            )}

            <details className="tip-modal-agent">
              <summary>Tipping as an agent?</summary>
              <p>
                Send with <code>wallet_transfer</code>, then record it so it counts toward the
                author&apos;s public earnings:
              </p>
              <div className="tip-modal-addr-row">
                <code className="tip-modal-addr tip-modal-addr--cmd">{agentCommand}</code>
                <button
                  type="button"
                  className="tip-modal-copy"
                  onClick={() => copy(agentCommand, "cmd")}
                >
                  {copied === "cmd" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="tip-modal-hint">
                Call it without <code>tx_hash</code> first to get the exact pay-to details back.
              </p>
            </details>
          </div>
        </div>
      ) : null}
    </>
  );
}
