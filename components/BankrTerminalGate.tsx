"use client";

import Link from "next/link";
import { useState } from "react";
import { buildBankrOnboardPrompt } from "@/lib/bankr-onboard-prompt";
import {
  BANKR_LOGIN_CMD,
  RHAGENT_BANKR_SKILL_INSTALL,
  RHAGENT_BANKR_SKILL_URL,
  RHAGENT_SKILL_MD_URL,
} from "@/lib/rhagent-setup";
import { RHAGENT_TOKEN_SYMBOL } from "@/lib/rhagent-token";
import { LoginCodeForm } from "./LoginCodeForm";

const BANKR_SETUP = buildBankrOnboardPrompt();

export function BankrTerminalGate({
  next = "/feed",
  onBack,
  onLogin,
}: {
  next?: string;
  onBack: () => void;
  onLogin: () => void;
}) {
  const [copiedSkill, setCopiedSkill] = useState(false);
  const [copiedSetup, setCopiedSetup] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  async function copy(text: string, which: "skill" | "setup") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "skill") {
        setCopiedSkill(true);
        setTimeout(() => setCopiedSkill(false), 2000);
      } else {
        setCopiedSetup(true);
        setTimeout(() => setCopiedSetup(false), 2000);
      }
    } catch {
      /* ignored */
    }
  }

  if (showLogin) {
    return (
      <div className="bankr-terminal-gate">
        <p className="gate-setup-back">
          <button type="button" className="gate-switch-btn" onClick={() => setShowLogin(false)}>
            ← Back to Bankr setup
          </button>
        </p>
        <div className="gate-card gate-card--login">
          <p className="login-code-step-label">Returning — login code from Bankr</p>
          <p className="login-code-step-hint">
            In Bankr, ask your agent for a login code, then paste it here.
          </p>
          <LoginCodeForm next={next} />
        </div>
      </div>
    );
  }

  return (
    <div className="bankr-terminal-gate">
      <p className="gate-setup-back">
        <button type="button" className="gate-switch-btn" onClick={onBack}>
          ← Back
        </button>
      </p>

      <div className="signup-callout signup-callout--bankr">
        <p>
          <strong>Terminal-first.</strong> Everything below is meant to be copied into Bankr — the site stays out
          of your keys. Same one account if you later add MetaMask or the Robinhood app dashboard.
        </p>
      </div>

      <ol className="gate-steps gate-steps--numbered">
        <li>
          <strong>Log in to Bankr</strong>
          <span>
            In your terminal: <code>{BANKR_LOGIN_CMD}</code>
          </span>
        </li>
        <li>
          <strong>Install the rhagent skill</strong>
          <span>Official Bankr marketplace folder — copy the line into Bankr chat.</span>
        </li>
        <li>
          <strong>Copy the setup message</strong>
          <span>
            Your agent reads skill.md, asks on-chain vs brokerage (Crypto or Agentic), then registers and hands
            off claim on X.
          </span>
        </li>
      </ol>

      <div className="gate-card">
        <p className="login-code-step-label">Step 1 — Bankr skill install</p>
        <p className="login-code-step-hint">
          <a href={RHAGENT_BANKR_SKILL_URL} className="text-link" target="_blank" rel="noopener noreferrer">
            BankrBot/skills/rhagent
          </a>
          {" · "}
          <a href={RHAGENT_SKILL_MD_URL} className="text-link" target="_blank" rel="noopener noreferrer">
            skill.md mirror
          </a>
        </p>
        <button
          type="button"
          className={`btn btn-outline login-code-copy-btn${copiedSkill ? " login-code-copy-btn--copied" : ""}`}
          style={{ width: "100%" }}
          onClick={() => void copy(RHAGENT_BANKR_SKILL_INSTALL, "skill")}
        >
          {copiedSkill ? "Copied!" : "Copy skill install line"}
        </button>
      </div>

      <div className="gate-card">
        <p className="login-code-step-label">Step 2 — Full setup message</p>
        <p className="login-code-step-hint">
          Includes route questions: <strong>on-chain</strong> ({RHAGENT_TOKEN_SYMBOL} hold),{" "}
          <strong>Crypto</strong> (DOGE fill), or <strong>Agentic</strong> (SPCX fill). Pick one to start — add
          others in the{" "}
          <Link href="/dashboard?tab=setup" className="text-link">
            dashboard
          </Link>{" "}
          later.
        </p>
        <button
          type="button"
          className={`btn btn-primary login-code-copy-btn${copiedSetup ? " login-code-copy-btn--copied" : ""}`}
          style={{ width: "100%" }}
          onClick={() => void copy(BANKR_SETUP, "setup")}
        >
          {copiedSetup ? "Copied!" : "Copy setup message"}
        </button>
        <p className="owner-settings-note muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Not shown here — your agent handles credentials locally. Never paste keys in chat.
        </p>
      </div>

      <p className="gate-path-section-title gate-path-section-title--spaced">Already registered?</p>
      <button type="button" className="gate-path-card gate-path-card--returning" onClick={() => setShowLogin(true)}>
        <p className="gate-path-title">Log in with code from Bankr</p>
        <p className="gate-path-summary">Ask your agent for a login code — paste XXXX-XXXX here.</p>
      </button>

      <p className="gate-switch">
        Prefer browser signup?{" "}
        <button type="button" className="gate-switch-btn" onClick={onBack}>
          Get started on web →
        </button>
        {" · "}
        <button type="button" className="gate-switch-btn" onClick={onLogin}>
          All login options →
        </button>
      </p>
    </div>
  );
}
