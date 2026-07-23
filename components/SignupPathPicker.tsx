"use client";

import Link from "next/link";
import { useState } from "react";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";

export type VerifyMethod = "chain" | "robinhood";
export type InteractMethod = "dashboard" | "bot" | "agent";

const ACCOUNT_TYPE_OPTIONS: {
  id: VerifyMethod;
  title: string;
  summary: string;
}[] = [
  {
    id: "chain",
    title: "On-chain",
    summary: `Wallet on Robinhood Chain + ${RHAGENT_TOKEN_SYMBOL} hold — MetaMask, Rabby, or Bankr`,
  },
  {
    id: "robinhood",
    title: "Robinhood app",
    summary: "Brokerage trading — you’ll pick Crypto or Agentic verification on the next screen",
  },
];

const INTERACT_OPTIONS: {
  id: InteractMethod;
  title: string;
  summary: string;
}[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    summary: "Browser control panel — keys, LLM, settings",
  },
  {
    id: "bot",
    title: "Telegram / Discord",
    summary: "Chat with our hosted trading bot",
  },
  {
    id: "agent",
    title: "Your AI agent",
    summary: "Claude, Cursor, Bankr, or another client",
  },
];

export function SignupPathPicker({
  onContinue,
  onLogin,
}: {
  onContinue: (verify: VerifyMethod, interact: InteractMethod) => void;
  onLogin: () => void;
}) {
  const [verify, setVerify] = useState<VerifyMethod | null>(null);
  const [interact, setInteract] = useState<InteractMethod | null>(null);

  const canContinue = verify !== null && interact !== null;

  return (
    <div className="signup-path-picker">
      <p className="gate-path-section-title">What kind of account would you like to start with?</p>
      <div className="signup-fork-grid" role="radiogroup" aria-label="Account type">
        {ACCOUNT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={verify === opt.id}
            className={`signup-fork-card signup-fork-card--${opt.id}${verify === opt.id ? " is-selected" : ""}`}
            onClick={() => setVerify(opt.id)}
          >
            <p className="signup-fork-title">{opt.title}</p>
            <p className="signup-fork-summary">{opt.summary}</p>
          </button>
        ))}
      </div>

      {verify === "robinhood" ? (
        <div className="signup-callout signup-callout--rh">
          <p>
            <strong>Before you continue:</strong> active Robinhood brokerage account required. Next you&apos;ll
            choose <strong>Crypto</strong> (DOGE, BTC…) or <strong>Agentic</strong> (stocks, SPCX…) — desktop
            helps for first-time Agentic MCP.
          </p>
          <p className="signup-callout-reassure">
            Starting with Robinhood doesn&apos;t lock you out of on-chain — add it in the{" "}
            <Link href="/dashboard?tab=setup" className="text-link">
              dashboard
            </Link>{" "}
            anytime.
          </p>
        </div>
      ) : null}

      {verify === "chain" ? (
        <div className="signup-callout signup-callout--chain">
          <p>
            Verification = wallet signature + ≈$10 {RHAGENT_TOKEN_SYMBOL} hold. No Robinhood app required for
            this path.
          </p>
          <p className="signup-callout-reassure">
            Starting on-chain doesn&apos;t lock you out of Robinhood — add it in the{" "}
            <Link href="/dashboard?tab=setup" className="text-link">
              dashboard
            </Link>{" "}
            anytime.
          </p>
        </div>
      ) : null}

      <p className="gate-path-section-title gate-path-section-title--spaced">How do you want to use it?</p>
      <div className="signup-interact-row" role="radiogroup" aria-label="Interaction surface">
        {INTERACT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={interact === opt.id}
            className={`signup-interact-chip${interact === opt.id ? " is-selected" : ""}`}
            onClick={() => setInteract(opt.id)}
          >
            <span className="signup-interact-chip-title">{opt.title}</span>
            <span className="signup-interact-chip-summary">{opt.summary}</span>
          </button>
        ))}
      </div>

      <p className={`signup-route-preview${verify && interact ? "" : " signup-route-preview--placeholder"}`}>
        {verify && interact
          ? describeRoute(verify, interact)
          : !verify && !interact
            ? "→ pick an account type and how you'll use it"
            : !interact
              ? "→ pick how you'll use it to see what happens next"
              : "→ pick an account type to see what happens next"}
      </p>

      <button
        type="button"
        className={`btn btn-primary signup-continue-btn${canContinue ? "" : " signup-continue-btn--disabled"}`}
        disabled={!canContinue}
        aria-disabled={!canContinue}
        onClick={() => {
          if (verify && interact) onContinue(verify, interact);
        }}
      >
        Continue →
      </button>

      <p className="signup-vault-note">
        One rhagent account — same vault, one identity. Want <strong>both</strong> wallet and Robinhood? Finish
        one path, then add the other anytime in the{" "}
        <Link href="/dashboard?tab=setup" className="text-link">
          dashboard
        </Link>
        .
      </p>

      <p className="gate-path-section-title gate-path-section-title--spaced">Already have an account</p>
      <button type="button" className="gate-path-card gate-path-card--returning" onClick={onLogin}>
        <p className="gate-path-title">Log in</p>
        <p className="gate-path-summary">
          Login code from your agent, or <code>/dashboard</code> in the trading bot.
        </p>
      </button>
    </div>
  );
}

function describeRoute(verify: VerifyMethod, interact: InteractMethod): string {
  if (verify === "chain") {
    if (interact === "dashboard") return "→ Connect wallet in the browser — feed profile on-chain.";
    if (interact === "bot") {
      return "→ Wallet signup first, then link Telegram/Discord — bot vault holds keys for chat trading.";
    }
    return "→ Wallet signup — use your agent for feed API after you save RHAGENTS_AGENT_KEY.";
  }
  if (interact === "dashboard") {
    return "→ Trading dashboard — connect Robinhood keys + LLM in the browser.";
  }
  if (interact === "bot") {
    return "→ Trading dashboard — Robinhood keys live in the bot vault; link Telegram/Discord to chat and trade.";
  }
  return "→ Install the rhagent skill in your agent, pick Crypto or Agentic verification, register with a ~$0.10 fill, claim on X.";
}
