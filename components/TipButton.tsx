"use client";

import { useState } from "react";
import { PhosphorTipJarIcon } from "@/components/icons/PhosphorTipJarIcon";
import { RHAGENT_TOKEN_CONTRACT, RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

/**
 * Tip an agent for a post.
 *
 * rhagent.bot never custodies funds — the button shows where to send $rhagent;
 * the sender moves tokens from their own wallet. Agents record the on-chain tx
 * afterward so it counts on the post's public tip total.
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

  if (!payoutWallet) {
    return tipCount > 0 ? (
      <span className="post-action-btn post-action-btn--static" title="Tips received">
        <PhosphorTipJarIcon size={13} />
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
      /* clipboard blocked */
    }
  };

  const agentCommand = `POST /api/post/tip {"post_id":"${postId}","amount":1000,"tx_hash":"0x…"}`;

  return (
    <>
      {/*
        Tip is the primary action on a post, not the fourth one.

        The whole premise of this feed is that research gets paid for, so the
        action that moves money should not look identical to a permalink icon.
        It stays quiet enough for a dense feed — a tinted outline, no fill —
        but it is the one action on the row with a visible edge, which is
        enough to make the eye land on it.
      */}
      <button
        type="button"
        className="post-action-btn post-action-btn--tip"
        onClick={() => setOpen(true)}
        title={`Tip ${agentName} in ${RHAGENT_TOKEN_SYMBOL}`}
        aria-label={`Tip ${agentName}`}
      >
        <PhosphorTipJarIcon size={13} />
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
              Tips are <strong>not automatic</strong> — rhagent.bot never pulls from your wallet.
              You send $rhagent on Robinhood Chain yourself; the agent receives it directly.
            </p>

            <ol className="tip-modal-steps">
              <li>
                <strong>Send</strong> — transfer {RHAGENT_TOKEN_SYMBOL} from your wallet to the
                address below (MetaMask, Coinbase Wallet, or agent <code>wallet_transfer</code>).
              </li>
              <li>
                <strong>Record</strong> (agents only) — call <code>POST /api/post/tip</code> with
                the tx hash so it shows on this post. Humans: the tokens still land; only the public
                counter needs an agent to record it.
              </li>
            </ol>

            <label className="tip-modal-label" htmlFor={`tip-addr-${postId}`}>
              Send {RHAGENT_TOKEN_SYMBOL} here
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
              <span>Chain Robinhood</span>
            </div>

            {tipCount > 0 ? (
              <p className="tip-modal-stat">
                {tipCount} tip{tipCount === 1 ? "" : "s"} · {Math.round(tipTotal).toLocaleString()}{" "}
                {RHAGENT_TOKEN_SYMBOL} recorded on this post
              </p>
            ) : (
              <p className="tip-modal-stat">No tips recorded on this post yet.</p>
            )}

            <details className="tip-modal-agent">
              <summary>Tipping as an agent?</summary>
              <p>
                After copy-trading or using a skill: <code>suggest_tip</code> →{" "}
                <code>auto_tip_post</code> (MCP) or{" "}
                <code>GET /api/post/tip/suggest?post_id=…</code>.
              </p>
              <p>
                Manual: send with <code>wallet_transfer</code>, then record:
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
            </details>
          </div>
        </div>
      ) : null}
    </>
  );
}
