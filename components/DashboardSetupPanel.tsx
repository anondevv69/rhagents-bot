"use client";

import { useState } from "react";
import type { AccountCapabilities, SetupProgress, UiDefaultSurface } from "@/lib/dashboard-setup-types";
import {
  SKILLS_BOT_ONLY_DISCLAIMER,
  deriveExpandedSections,
} from "@/lib/dashboard-setup-types";
import { DashboardConnectPanel } from "@/components/DashboardConnectPanel";

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

const SURFACE_OPTIONS: { id: UiDefaultSurface; label: string; hint: string }[] = [
  { id: "mcp", label: "Claude / Cursor / MCP", hint: "Robinhood already in your MCP client — paste token here to bridge." },
  { id: "bot", label: "Telegram / Discord bot", hint: "Chat-first — skills, jobs, and cron live here." },
  { id: "bankr", label: "Bankr / on-chain", hint: "Optional wallet for on-chain; Robinhood still separate." },
  { id: "unset", label: "Not sure yet", hint: "Show everything — sections expand based on what you connect." },
];

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="gate-card" style={{ marginTop: 12 }}>
      <button
        type="button"
        className="owner-settings-heading"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {expanded ? "▾" : "▸"} {title}
      </button>
      {expanded ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </div>
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
  const [expanded, setExpanded] = useState(expandedDefaults);

  const toggle = (key: keyof typeof expanded) =>
    setExpanded((e) => ({ ...e, [key]: !e[key] }));

  return (
    <div className="panel trading-dash-setup">
      <div className="panel-header-row">
        <div>
          <h2 className="owner-settings-heading" style={{ marginBottom: 4 }}>
            Setup
          </h2>
          <p className="owner-settings-note muted">
            Sections update as you connect things — not a one-time path. MCP, bot, and Bankr can coexist on one account.
          </p>
        </div>
        {!caps.has_wallet && onAddWallet ? (
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void onAddWallet()}>
            {busy ? "Working…" : "Add Bankr wallet"}
          </button>
        ) : null}
      </div>

      <div className="gate-card" style={{ marginTop: 12 }}>
        <h3 className="owner-settings-heading" style={{ fontSize: 14, marginBottom: 8 }}>
          How are you using rhagent?
        </h3>
        <p className="owner-settings-note muted" style={{ marginBottom: 10 }}>
          Sets which sections start expanded — you can change this anytime. Nothing is hidden.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SURFACE_OPTIONS.filter((o) => o.id !== "unset").map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`btn ${caps.ui_default_surface === opt.id ? "btn-primary" : "btn-outline"}`}
              disabled={busy}
              onClick={() => void onSurfacePreference?.(opt.id)}
              title={opt.hint}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Section title="Robinhood & connections" expanded={expanded.connections} onToggle={() => toggle("connections")}>
        <ul className="trading-dash-setup-steps" style={{ listStyle: "none", padding: 0 }}>
          <li className={`trading-dash-setup-step${caps.has_rh_keys ? " is-done" : ""}`}>
            <span className="trading-dash-setup-check">{caps.has_rh_keys ? "✓" : "○"}</span>
            <div>
              <strong>Robinhood Crypto or Agentic</strong>
              {!caps.has_rh_keys ? (
                <p className="owner-settings-note muted">
                  {caps.has_agentic_token
                    ? "Agentic token connected."
                    : "Connections tab — Crypto keypair or Agentic OAuth / MCP token."}
                </p>
              ) : null}
            </div>
          </li>
          {caps.has_agentic_token ? (
            <li className="trading-dash-setup-step is-done">
              <span className="trading-dash-setup-check">✓</span>
              <div>
                <strong>Agentic via MCP token (Option B)</strong>
                <p className="owner-settings-note muted">Connected — same token can power bot + your MCP client.</p>
              </div>
            </li>
          ) : null}
        </ul>
        {!caps.has_rh_keys && onGoConnections ? (
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={onGoConnections}>
            Open Connections
          </button>
        ) : null}
      </Section>

      <Section title="Telegram / Discord (optional)" expanded={expanded.platform} onToggle={() => toggle("platform")}>
        <p className="owner-settings-note muted">
          {caps.has_platform_link
            ? "Platform linked — chat, skills, and jobs sync with this dashboard."
            : "Not connected — optional unless you want mobile chat or bot-native skills/jobs."}
        </p>
        {!caps.has_platform_link ? (
          <>
            <DashboardConnectPanel platformLinked={platformLinked} onConnected={onRefresh} />
            {botDeepLink ? (
              <p className="owner-settings-note" style={{ marginTop: 12 }}>
                Or tap{" "}
                <a href={botDeepLink} className="text-link" target="_blank" rel="noreferrer">
                  Open Telegram bot
                </a>{" "}
                and send <code className="docs-code-inline">/start</code>.
              </p>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="Bankr wallet (optional)" expanded={expanded.wallet} onToggle={() => toggle("wallet")}>
        {setup.bankrWalletAddress ? (
          <p className="owner-settings-note muted">
            Bankr wallet: <code className="docs-code-inline">{setup.bankrWalletAddress}</code>
            {" · "}
            Manage via <code className="docs-code-inline">/wallet</code> in chat.
          </p>
        ) : (
          <p className="owner-settings-note muted">
            No wallet yet — optional for on-chain execution. Robinhood Crypto/Agentic and MCP work without it. Link an
            existing key with <code className="docs-code-inline">/connect_bankr</code> or add one here.
          </p>
        )}
      </Section>

      <Section title="Skills & jobs" expanded={expanded.skillsJobs} onToggle={() => toggle("skillsJobs")}>
        {!caps.has_platform_link ? (
          <p className="owner-settings-note">{SKILLS_BOT_ONLY_DISCLAIMER}</p>
        ) : (
          <p className="owner-settings-note muted">Active for your linked Telegram/Discord bot.</p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
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
      </Section>

      {(chatEngine || managedInferenceLine) && (
        <p className="owner-settings-note" style={{ marginTop: 12 }}>
          Chat engine: <code className="docs-code-inline">{chatEngine ?? "—"}</code>
          {managedInferenceLine ? <> · {managedInferenceLine}</> : null}
        </p>
      )}

      {setup.rhagents ? null : onGoConnections ? (
        <p className="owner-settings-note" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-outline" onClick={onGoConnections}>
            Create rhagent.bot profile
          </button>{" "}
          — optional feed auto-posting (MetaMask or agent key).
        </p>
      ) : null}
    </div>
  );
}
