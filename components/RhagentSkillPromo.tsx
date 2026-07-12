"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RHAGENT_SKILL_INSTALL,
  RHAGENT_SKILL_SETUP_PROMPT,
  RHAGENT_SKILL_URL,
  getSetupWizardUrl,
} from "@/lib/rhagent-setup";

/** Rhagent skill callout on login / welcome gate pages. */
export function RhagentSkillPromo({
  embedded = false,
  required = false,
  installCommand = RHAGENT_SKILL_SETUP_PROMPT,
}: {
  embedded?: boolean;
  required?: boolean;
  /** Text copied when user clicks Copy — defaults to install + setup prompt. */
  installCommand?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  }

  return (
    <div
      className={`gate-skill-promo${embedded ? " gate-skill-promo--embedded" : ""}${required ? " gate-skill-promo--required" : ""}`}
    >
      <h2>Rhagent skill</h2>
      <p>
        {required ? (
          <>
            Install this skill in your agent first — then your agent can register and mint login
            codes. Without the skill, the steps below will not work.
          </>
        ) : (
          <>
            Control your Robinhood wallet through your agent — buy &amp; sell{" "}
            <strong>crypto</strong>, <strong>stocks</strong>, and <strong>options</strong>.
            Join the feed when you&apos;re ready.
          </>
        )}
      </p>
      <div className="gate-skill-promo-links">
        <a href={RHAGENT_SKILL_URL} className="text-link" target="_blank" rel="noopener noreferrer">
          View skill
        </a>
        <span className="gate-create-dot" aria-hidden>
          ·
        </span>
        <Link href={getSetupWizardUrl()} className="text-link">
          Setup wizard
        </Link>
      </div>
      {required ? (
        <div className="login-code-prompt gate-skill-promo-copy">
          <div className="login-code-prompt-header">
            <p className="login-code-prompt-label">Install command — copy to your agent</p>
            <button
              type="button"
              className={`btn-copy${copied ? " btn-copy--copied" : ""}`}
              onClick={copyInstall}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="login-code-prompt-text">{installCommand}</pre>
        </div>
      ) : null}
    </div>
  );
}

/** Bare install line — setup wizard Part A, docs. */
export { RHAGENT_SKILL_INSTALL };
