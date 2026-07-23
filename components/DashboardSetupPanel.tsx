"use client";

import { useEffect, useState } from "react";
import type { AccountCapabilities, SetupProgress, UiDefaultSurface } from "@/lib/dashboard-setup-types";
import {
  SKILLS_BOT_ONLY_DISCLAIMER,
  deriveExpandedSections,
} from "@/lib/dashboard-setup-types";
import { DashboardConnectPanel } from "@/components/DashboardConnectPanel";
import { DashboardWelcomeGoals, expandedFromGoal } from "@/components/DashboardWelcomeGoals";
import type { OnboardingGoal } from "@/lib/dashboard-onboarding-goals";

type Props = {
  setup: SetupProgress;
  capabilities: AccountCapabilities;
  platformLinked?: boolean;
  chatEngine?: string;
  managedInferenceLine?: string | null;
  busy?: boolean;
  onAddWallet?: () => Promise<void>;
  onGoConnections?: () => void;
  onGoSkills?: () => void;
  onGoJobs?: () => void;
  onSurfacePreference?: (surface: UiDefaultSurface) => Promise<void>;
  botDeepLink?: string | null;
  onRefresh?: () => void;
};

const SURFACE_OPTIONS: { id: UiDefaultSurface; label: string }[] = [
  { id: "mcp", label: "Claude / MCP" },
  { id: "bot", label: "Telegram / Discord" },
  { id: "bankr", label: "Bankr / on-chain" },
];

function StatusChip({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`trading-dash-setup-chip${done ? " is-done" : ""}`}>
      {done ? "✓" : "○"} {label}
    </span>
  );
}

function SetupSection({
  title,
  subtitle,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`trading-dash-setup-section${expanded ? " is-open" : ""}`}>
      <button type="button" className="trading-dash-setup-section-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="trading-dash-setup-section-chevron">{expanded ? "▾" : "▸"}</span>
        <span className="trading-dash-setup-section-titles">
          <span className="trading-dash-setup-section-title">{title}</span>
          {subtitle ? <span className="trading-dash-setup-section-sub muted">{subtitle}</span> : null}
        </span>
      </button>
      {expanded ? <div className="trading-dash-setup-section-body">{children}</div> : null}
    </section>
  );
}

export function DashboardSetupPanel({
  setup,
  capabilities: caps,
  platformLinked,
  chatEngine,
  managedInferenceLine,
  busy,
  onAddWallet,
  onGoConnections,
  onGoSkills,
  onGoJobs,
  onSurfacePreference,
  botDeepLink,
  onRefresh,
}: Props) {
  const expandedDefaults = deriveExpandedSections(caps);
  const [expanded, setExpanded] = useState({ ...expandedDefaults, profile: !setup.rhagents });

  useEffect(() => {
    setExpanded((e) => ({
      ...deriveExpandedSections(caps),
      profile: !setup.rhagents ? e.profile : false,
    }));
  }, [
    caps.has_agentic_token,
    caps.has_platform_link,
    caps.has_wallet,
    caps.has_rh_keys,
    caps.ui_default_surface,
    setup.rhagents,
  ]);

  const toggle = (key: keyof typeof expanded) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const doneCount = [
    caps.has_rh_keys,
    caps.has_platform_link,
    caps.has_wallet,
    setup.rhagents,
  ].filter(Boolean).length;

  const [welcomeDone, setWelcomeDone] = useState(() => {
    if (typeof window === "undefined") return doneCount > 0 || caps.ui_default_surface !== "unset";
    return (
      doneCount > 0 ||
      caps.ui_default_surface !== "unset" ||
      window.localStorage.getItem("rhagent_dashboard_welcome") === "1"
    );
  });

  const showWelcome = !welcomeDone && doneCount === 0 && caps.ui_default_surface === "unset";

  async function pickGoal(goal: OnboardingGoal, surface: UiDefaultSurface) {
    setExpanded(expandedFromGoal(goal));
    setWelcomeDone(true);
    if (typeof window !== "undefined") window.localStorage.setItem("rhagent_dashboard_welcome", "1");
    if (surface !== "unset") await onSurfacePreference?.(surface);
    if (goal === "rh_crypto" || goal === "rh_agentic" || goal === "feed") onGoConnections?.();
  }

  return (
    <div className="panel trading-dash-setup">
      {showWelcome ? (
        <DashboardWelcomeGoals busy={busy} onPick={(g, s) => void pickGoal(g, s)} />
      ) : null}

      {!showWelcome ? (
        <>
      <header className="trading-dash-setup-header">
        <div>
          <h2 className="owner-settings-heading">Setup</h2>
          <p className="owner-settings-note muted">
            {doneCount}/4 connected — sections update as you link things. MCP, bot, and Bankr can all use the same
            account.
          </p>
        </div>
      </header>

      <div className="trading-dash-setup-chips">
        <StatusChip done={caps.has_rh_keys} label="Robinhood" />
        <StatusChip done={caps.has_platform_link} label="Chat bot" />
        <StatusChip done={caps.has_wallet} label="Bankr wallet" />
        <StatusChip done={setup.rhagents} label="Feed profile" />
      </div>

      {(chatEngine || managedInferenceLine) && (
        <p className="trading-dash-setup-meta">
          Chat engine: <code className="docs-code-inline">{chatEngine ?? "—"}</code>
          {managedInferenceLine ? <> · {managedInferenceLine}</> : null}
        </p>
      )}

      <div className="trading-dash-setup-surface">
        <p className="trading-dash-setup-surface-label">How are you using rhagent?</p>
        <div className="trading-dash-setup-surface-btns">
          {SURFACE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn ${caps.ui_default_surface === opt.id ? "btn-primary" : "btn-outline"}`}
              disabled={busy}
              onClick={() => void onSurfacePreference?.(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="owner-settings-note muted">Sets which section opens first — nothing is hidden.</p>
      </div>

      <div className="trading-dash-setup-sections">
        <SetupSection
          title="Robinhood"
          subtitle={caps.has_rh_keys ? "Connected" : "Crypto and/or Agentic — required to trade"}
          expanded={expanded.connections}
          onToggle={() => toggle("connections")}
        >
          <ul className="trading-dash-setup-steps">
            <li className={`trading-dash-setup-step${caps.has_rh_keys ? " is-done" : ""}`}>
              <span className="trading-dash-setup-check">{caps.has_rh_keys ? "✓" : "○"}</span>
              <div>
                <strong>Robinhood Crypto or Agentic</strong>
                <p className="owner-settings-note muted">
                  Connections tab — keypair + rh-api-… for Crypto; OAuth script or paste MCP token for Agentic.
                </p>
              </div>
            </li>
            {caps.has_agentic_token ? (
              <li className="trading-dash-setup-step is-done">
                <span className="trading-dash-setup-check">✓</span>
                <div>
                  <strong>Agentic token (MCP bridge)</strong>
                  <p className="owner-settings-note muted">Same token works in Claude/Cursor and here.</p>
                </div>
              </li>
            ) : null}
          </ul>
          {onGoConnections ? (
            <button type="button" className="btn btn-primary" onClick={onGoConnections}>
              Open Connections
            </button>
          ) : null}
        </SetupSection>

        <SetupSection
          title="Telegram / Discord"
          subtitle={caps.has_platform_link ? "Connected" : "Optional — for mobile chat & bot skills"}
          expanded={expanded.platform}
          onToggle={() => toggle("platform")}
        >
          <DashboardConnectPanel embedded platformLinked={platformLinked} busy={busy} onConnected={onRefresh} />
          {botDeepLink && !caps.has_platform_link ? (
            <p className="owner-settings-note muted">
              Or{" "}
              <a href={botDeepLink} className="text-link" target="_blank" rel="noreferrer">
                open Telegram
              </a>{" "}
              and send <code className="docs-code-inline">/start</code>.
            </p>
          ) : null}
        </SetupSection>

        <SetupSection
          title="Bankr wallet"
          subtitle={caps.has_wallet ? "Connected" : "Optional — on-chain only"}
          expanded={expanded.wallet}
          onToggle={() => toggle("wallet")}
        >
          {setup.bankrWalletAddress ? (
            <p className="owner-settings-note">
              <code className="docs-code-inline">{setup.bankrWalletAddress}</code>
              {" · "}
              <code className="docs-code-inline">/connect_bankr</code> to link existing ·{" "}
              <code className="docs-code-inline">/wallet</code> in chat
            </p>
          ) : (
            <>
              <p className="owner-settings-note muted">
                Robinhood and MCP work without this. Add a new wallet or link an existing Bankr key (
                <code className="docs-code-inline">bk_usr_…</code>) — not MetaMask; that&apos;s for your feed profile
                below.
              </p>
              {onAddWallet ? (
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void onAddWallet()}>
                  {busy ? "Working…" : "Create Bankr wallet"}
                </button>
              ) : null}
            </>
          )}
        </SetupSection>

        <SetupSection
          title="Skills & jobs"
          subtitle={caps.has_platform_link ? "Active for your bot" : "Bot-only"}
          expanded={expanded.skillsJobs}
          onToggle={() => toggle("skillsJobs")}
        >
          <p className="owner-settings-note">{SKILLS_BOT_ONLY_DISCLAIMER}</p>
          <div className="trading-dash-setup-actions">
            {onGoSkills ? (
              <button type="button" className="btn btn-outline" onClick={onGoSkills}>
                Skills
              </button>
            ) : null}
            {onGoJobs ? (
              <button type="button" className="btn btn-outline" onClick={onGoJobs}>
                Jobs
              </button>
            ) : null}
          </div>
        </SetupSection>

        <SetupSection
          title="rhagent.bot profile"
          subtitle={setup.rhagents ? "Connected" : "Optional — auto-post trades to feed"}
          expanded={expanded.profile}
          onToggle={() => toggle("profile")}
        >
          {setup.rhagents ? (
            <p className="owner-settings-note muted">Profile linked — edit on Connections or /account.</p>
          ) : onGoConnections ? (
            <button type="button" className="btn btn-outline" onClick={onGoConnections}>
              Create profile (MetaMask or agent key)
            </button>
          ) : null}
        </SetupSection>
      </div>
        </>
      ) : null}
    </div>
  );
}
